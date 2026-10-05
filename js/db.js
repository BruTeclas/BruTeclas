/*
 * Acesso aos dados. Usa o Supabase quando configurado em js/config.js;
 * senão, um "modo demonstração" que guarda tudo no localStorage.
 *
 * Perfil (tabela "perfis"):
 *   { id, slug, status: "rascunho" | "ativo" | "inativo", dados: {...},
 *     cliente_id, vencimento, observacoes, created_at, updated_at,
 *     cliente: { id, nome, telefone, whatsapp, email } | null }   <- junção, só leitura
 *
 * Cliente (tabela "clientes"): nome, tipo_pessoa, documento (CPF/CNPJ), nascimento,
 *   email, telefone, whatsapp, endereço (cep, logradouro, numero, complemento,
 *   bairro, cidade, uf), redes { instagram, facebook, ... , site }, plano,
 *   valor_mensal, observacoes.
 */
(function () {
  "use strict";
  var cfg = window.CONFIG || {};
  var BUCKET = "imagens";
  var RESERVADOS = ["admin", "perfil", "js", "css", "img", "api", "assets", "index", "404", "supabase", "login", "www"];
  var CAMPOS_CLIENTE_RESUMO = "id,nome,telefone,whatsapp,email";
  var UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
  var REDES_CLIENTE = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "kwai", "pinterest", "telegram", "site"];

  function erro(msg, campo) { var e = new Error(msg); e.amigavel = true; if (campo) e.campo = campo; return e; }
  function soDigitos(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
  function texto(s) { s = String(s == null ? "" : s).trim(); return s || null; }

  function validarSlug(slug) {
    slug = String(slug || "").trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug))
      throw erro("O link deve ter de 3 a 40 caracteres: letras minúsculas, números e hífen (sem começar ou terminar com hífen).");
    if (RESERVADOS.indexOf(slug) >= 0) throw erro("Esse link é reservado pelo sistema. Escolha outro.");
    return slug;
  }

  function gerarSlug(textoBase) {
    return String(textoBase || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  }

  function dadosIniciais(nome) {
    return {
      nome: nome || "", descricao: "", foto: "", capa: "", cor: "#7c3aed", tema: "escuro",
      links: [], mostrarSalvarContato: true, mostrarCompartilhar: true
    };
  }

  // ---------------------------------------------------------------------------
  // Clientes: validação e normalização (iguais às regras do banco)
  // ---------------------------------------------------------------------------
  function cpfValido(d) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }
  function cnpjValido(d) {
    if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
    function dv(base) {
      var pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < base.length; i++) s += Number(base[i]) * pesos[i];
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
  }
  function telefoneBR(v, rotulo, campo) {
    var d = soDigitos(v);
    if (!d) return null;
    if (d.length === 10 || d.length === 11) d = "55" + d;          // sem DDI: assume Brasil
    if (d.length < 10 || d.length > 13) throw erro(rotulo + " inválido. Use DDD + número, por exemplo (11) 99999-9999.", campo);
    return d;
  }

  // Devolve um objeto pronto para gravar ou lança erro com o campo problemático.
  function validarCliente(c) {
    c = c || {};
    var r = {};
    r.nome = texto(c.nome);
    if (!r.nome) throw erro("Informe o nome do cliente.", "nome");
    if (r.nome.length > 120) throw erro("O nome pode ter no máximo 120 caracteres.", "nome");
    r.tipo_pessoa = c.tipo_pessoa === "juridica" ? "juridica" : "fisica";
    var doc = soDigitos(c.documento);
    if (doc) {
      if (r.tipo_pessoa === "fisica" && !cpfValido(doc)) throw erro("CPF inválido. Confira os números.", "documento");
      if (r.tipo_pessoa === "juridica" && !cnpjValido(doc)) throw erro("CNPJ inválido. Confira os números.", "documento");
    }
    r.documento = doc || null;
    r.nascimento = texto(c.nascimento);
    if (r.nascimento && (!/^\d{4}-\d{2}-\d{2}$/.test(r.nascimento) || r.nascimento > new Date().toISOString().slice(0, 10)))
      throw erro("Data inválida.", "nascimento");
    r.email = texto(c.email);
    if (r.email) {
      r.email = r.email.toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) throw erro("E-mail inválido.", "email");
    }
    r.telefone = telefoneBR(c.telefone, "Telefone", "telefone");
    r.whatsapp = telefoneBR(c.whatsapp, "WhatsApp", "whatsapp");
    var cep = soDigitos(c.cep);
    if (cep && cep.length !== 8) throw erro("O CEP deve ter 8 números.", "cep");
    r.cep = cep || null;
    ["logradouro", "numero", "complemento", "bairro", "cidade"].forEach(function (k) { r[k] = texto(c[k]); });
    r.uf = texto(c.uf);
    if (r.uf) {
      r.uf = r.uf.toUpperCase();
      if (UFS.indexOf(r.uf) < 0) throw erro("UF inválida.", "uf");
    }
    r.redes = {};
    var redes = c.redes || {};
    REDES_CLIENTE.forEach(function (k) {
      var v = texto(redes[k]);
      if (!v) return;
      if (k === "site" && !/^https?:\/\//i.test(v)) v = "https://" + v;
      r.redes[k] = k === "site" ? v : v.replace(/^@/, "");
    });
    r.plano = texto(c.plano);
    var valor = texto(c.valor_mensal);
    if (valor != null) {
      var n = Number(String(valor).replace(/\./g, "").replace(",", "."));
      if (!isFinite(n) || n < 0) throw erro("Valor mensal inválido.", "valor_mensal");
      r.valor_mensal = Math.round(n * 100) / 100;
    } else r.valor_mensal = null;
    r.observacoes = texto(c.observacoes);
    return r;
  }

  // ===========================================================================
  // Modo demonstração (localStorage, ou memória se o navegador bloquear)
  // ===========================================================================
  function imagemSvg(svg) { return "data:image/svg+xml," + encodeURIComponent(svg); }
  function avatarExemplo(iniciais, c1, c2) {
    return imagemSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<rect width="200" height="200" fill="url(#g)"/><text x="100" y="100" dy=".35em" text-anchor="middle" ' +
      'font-family="Arial,sans-serif" font-size="70" font-weight="700" fill="#fff">' + iniciais + '</text></svg>');
  }
  function diasDaqui(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function dataAtras(i) { return new Date(Date.now() - i * 864e5).toISOString(); }

  function clientesExemplo() {
    function cliente(i, id, c) {
      return Object.assign({ id: id, created_at: dataAtras(i), updated_at: dataAtras(i) }, validarCliente(c));
    }
    return [
      cliente(1, "cliente-bella", {
        nome: "Bella Souza (exemplo)", tipo_pessoa: "fisica", email: "bella@exemplo.com", whatsapp: "19999999999",
        cep: "13010000", logradouro: "Rua Barão de Jaguara", numero: "100", bairro: "Centro", cidade: "Campinas", uf: "SP",
        redes: { instagram: "studiobella", tiktok: "studiobella", pinterest: "studiobella" },
        plano: "Mensal", valor_mensal: "19,90", observacoes: "Chaveiro nº 001"
      }),
      cliente(2, "cliente-joao", {
        nome: "João Lima (exemplo)", tipo_pessoa: "fisica", telefone: "11988887777", whatsapp: "11988887777",
        cidade: "São Paulo", uf: "SP", redes: { instagram: "barbeariadojoao" }, plano: "Mensal", valor_mensal: "19,90",
        observacoes: "Pagamento atrasado."
      }),
      cliente(3, "cliente-ana", {
        nome: "Ana Costa (exemplo)", tipo_pessoa: "fisica", email: "ana@exemplo.com", whatsapp: "21977776666",
        cidade: "Rio de Janeiro", uf: "RJ", plano: "Anual", valor_mensal: "9,90"
      })
    ];
  }

  // Perfis de exemplo, um em cada situação.
  function exemplosDemo() {
    function perfil(i, slug, status, clienteId, dados, interno) {
      return Object.assign({
        id: "exemplo-" + slug, slug: slug, status: status, cliente_id: clienteId,
        dados: Object.assign(dadosIniciais(), dados), created_at: dataAtras(i), updated_at: dataAtras(i)
      }, interno);
    }
    return [
      perfil(1, "studio-bella", "ativo", "cliente-bella", {
        nome: "Studio Bella Unhas", descricao: "Manicure & Nail Designer • Campinas/SP\nAtendimento com hora marcada 💅",
        foto: avatarExemplo("SB", "#e11d74", "#f59e0b"), cor: "#e11d74",
        links: [
          { id: "l1", tipo: "whatsapp", numero: "5519999999999", mensagem: "Olá! Vim pelo chaveiro e quero agendar um horário." },
          { id: "l2", tipo: "pix", chave: "bella@exemplo.com", nome: "Bella Souza", cidade: "Campinas" },
          { id: "l3", tipo: "link", titulo: "Tabela de preços", subtitulo: "Mãos, pés e alongamento", url: "https://exemplo.com/precos", icone: "fa-solid fa-tags" },
          { id: "l4", tipo: "google_avaliar", url: "https://g.page/r/exemplo/review" },
          { id: "l5", tipo: "maps", url: "https://maps.google.com/?q=Campinas" },
          { id: "l6", tipo: "instagram", usuario: "studiobella" },
          { id: "l7", tipo: "tiktok", usuario: "studiobella" },
          { id: "l8", tipo: "pinterest", usuario: "studiobella" }
        ]
      }, { vencimento: diasDaqui(18), observacoes: "Plano mensal R$ 19,90 • chaveiro nº 001" }),
      perfil(2, "barbearia-do-joao", "inativo", "cliente-joao", {
        nome: "Barbearia do João", descricao: "Corte & barba • Desde 2015",
        foto: avatarExemplo("BJ", "#a16207", "#111827"), cor: "#a16207",
        links: [
          { id: "l1", tipo: "whatsapp", numero: "5511988887777" },
          { id: "l2", tipo: "maps", url: "https://maps.google.com/?q=Sao+Paulo" },
          { id: "l3", tipo: "instagram", usuario: "barbeariadojoao" }
        ]
      }, { vencimento: diasDaqui(-12), observacoes: "Pagamento atrasado. Desativado até regularizar." }),
      perfil(3, "pet-thor", "rascunho", "cliente-ana", {
        nome: "Thor 🐶", descricao: "Me encontrou? Por favor, chame meu tutor!",
        foto: avatarExemplo("T", "#0ea5e9", "#22c55e"), cor: "#0ea5e9", tema: "claro",
        links: [
          { id: "l1", tipo: "whatsapp", numero: "5521977776666", rotulo: "Avisar o tutor", mensagem: "Oi! Encontrei o Thor." },
          { id: "l2", tipo: "telefone", numero: "+55 21 97777-6666" }
        ]
      }, { vencimento: null, observacoes: "Chaveiro de coleira. Falta a foto do pet." })
    ];
  }

  function criarDemo() {
    var CHAVE = "bt_demo_perfis", CHAVE_CLIENTES = "bt_demo_clientes", CHAVE_SESSAO = "bt_demo_sessao";
    var memoria = {};
    var usaLocal = (function () {
      try { localStorage.setItem("bt_teste", "1"); localStorage.removeItem("bt_teste"); return true; } catch (e) { return false; }
    })();
    var guarda = {
      ler: function (k) { return usaLocal ? localStorage.getItem(k) : (k in memoria ? memoria[k] : null); },
      gravar: function (k, v) { if (usaLocal) localStorage.setItem(k, v); else memoria[k] = v; },
      apagar: function (k) { if (usaLocal) localStorage.removeItem(k); else delete memoria[k]; }
    };
    function lerLista(k) { try { return JSON.parse(guarda.ler(k)) || []; } catch (e) { return []; } }
    function gravarLista(k, lista) {
      try { guarda.gravar(k, JSON.stringify(lista)); }
      catch (e) { throw erro("Espaço do modo demonstração esgotado. Use imagens menores ou configure o Supabase."); }
    }

    // Cria os exemplos na primeira vez e converte dados de versões antigas.
    function preparar() {
      if (guarda.ler(CHAVE_CLIENTES) !== null) return;
      if (guarda.ler(CHAVE) === null) {
        gravarLista(CHAVE, exemplosDemo());
        gravarLista(CHAVE_CLIENTES, clientesExemplo());
        return;
      }
      // Versão antiga: o nome do cliente ficava dentro do perfil. Vira um cliente de verdade.
      var perfis = lerLista(CHAVE), clientes = [], porNome = {};
      perfis.forEach(function (p) {
        var c = p.dados && p.dados.capa;
        if (c && c.indexOf("data:image/svg+xml,") === 0 && decodeURIComponent(c.slice(19)).indexOf('<circle cx="330" cy="90" r="190"') >= 0) p.dados.capa = "";
        var nome = String(p.cliente_nome || "").trim();
        if (nome && !p.cliente_id) {
          if (!porNome[nome]) {
            var contato = String(p.cliente_contato || "").trim(), novo = { nome: nome };
            if (/@/.test(contato)) novo.email = contato; else if (soDigitos(contato).length >= 10) novo.whatsapp = contato;
            var cli;
            try { cli = validarCliente(novo); } catch (e) { cli = validarCliente({ nome: nome, observacoes: contato }); }
            porNome[nome] = Object.assign({ id: uuid(), created_at: p.created_at || agora(), updated_at: agora() }, cli);
            clientes.push(porNome[nome]);
          }
          p.cliente_id = porNome[nome].id;
        }
        if (p.cliente_id === undefined) p.cliente_id = null;
        delete p.cliente_nome; delete p.cliente_contato;
      });
      gravarLista(CHAVE, perfis);
      gravarLista(CHAVE_CLIENTES, clientes);
    }
    function ler() { preparar(); return lerLista(CHAVE); }
    function lerClientes() { preparar(); return lerLista(CHAVE_CLIENTES); }
    function agora() { return new Date().toISOString(); }
    function uuid() { return (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
    function slugEmUso(lista, slug, id) { return lista.some(function (p) { return p.slug === slug && p.id !== id; }); }
    function resumoCliente(clientes, id) {
      var c = id && clientes.filter(function (x) { return x.id === id; })[0];
      return c ? { id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, email: c.email } : null;
    }
    function comCliente(p, clientes) { return Object.assign({}, p, { cliente: resumoCliente(clientes || lerClientes(), p.cliente_id) }); }
    function docEmUso(lista, doc, id) { return doc && lista.some(function (c) { return c.documento === doc && c.id !== id; }); }

    return {
      demo: true,
      sessao: function () { var e = guarda.ler(CHAVE_SESSAO); return Promise.resolve(e ? { email: e } : null); },
      entrar: function (email) { guarda.gravar(CHAVE_SESSAO, email || "demo"); return Promise.resolve({ email: email }); },
      sair: function () { guarda.apagar(CHAVE_SESSAO); return Promise.resolve(); },
      recuperarSenha: function () { return Promise.resolve(); },
      alterarSenha: function (atual, nova) { return Promise.resolve().then(function () { validarSenha(nova); }); },

      listar: function () {
        var clientes = lerClientes();
        return Promise.resolve(ler().map(function (p) { return comCliente(p, clientes); })
          .sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }));
      },
      obter: function (id) {
        var p = ler().filter(function (x) { return x.id === id; })[0];
        return Promise.resolve(p ? comCliente(p) : null);
      },
      criar: function (campos) {
        return Promise.resolve().then(function () {
          var lista = ler(), slug = validarSlug(campos.slug);
          if (slugEmUso(lista, slug)) throw erro("O link \"" + slug + "\" já está em uso.");
          var p = {
            id: uuid(), slug: slug, status: "rascunho", dados: campos.dados || dadosIniciais(),
            cliente_id: campos.cliente_id || null, vencimento: null, observacoes: null,
            created_at: agora(), updated_at: agora()
          };
          lista.push(p); gravarLista(CHAVE, lista); return comCliente(p);
        });
      },
      salvar: function (id, patch) {
        return Promise.resolve().then(function () {
          var lista = ler(), p = lista.filter(function (x) { return x.id === id; })[0];
          if (!p) throw erro("Perfil não encontrado.");
          if (patch.slug != null) {
            patch.slug = validarSlug(patch.slug);
            if (slugEmUso(lista, patch.slug, id)) throw erro("O link \"" + patch.slug + "\" já está em uso.");
          }
          Object.assign(p, patch, { updated_at: agora() });
          gravarLista(CHAVE, lista); return comCliente(p);
        });
      },
      excluir: function (id) {
        gravarLista(CHAVE, ler().filter(function (p) { return p.id !== id; }));
        return Promise.resolve();
      },
      enviarImagem: function (perfilId, blob) {
        return new Promise(function (ok, falha) {
          var r = new FileReader();
          r.onload = function () { ok(r.result); };
          r.onerror = falha;
          r.readAsDataURL(blob);
        });
      },
      removerImagem: function () { return Promise.resolve(); },
      perfilPublico: function (slug) {
        var p = ler().filter(function (x) { return x.slug === String(slug).toLowerCase(); })[0];
        if (!p) return Promise.resolve(null);
        return Promise.resolve(p.status === "ativo" ? { status: "ativo", dados: p.dados } : { status: p.status });
      },

      listarClientes: function () {
        var perfis = ler();
        return Promise.resolve(lerClientes().map(function (c) {
          return Object.assign({}, c, { total_perfis: perfis.filter(function (p) { return p.cliente_id === c.id; }).length });
        }).sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); }));
      },
      obterCliente: function (id) { return Promise.resolve(lerClientes().filter(function (c) { return c.id === id; })[0] || null); },
      criarCliente: function (dados) {
        return Promise.resolve().then(function () {
          var lista = lerClientes(), c = validarCliente(dados);
          if (docEmUso(lista, c.documento)) throw erro("Já existe um cliente com esse CPF/CNPJ.", "documento");
          c = Object.assign({ id: uuid(), created_at: agora(), updated_at: agora() }, c);
          lista.push(c); gravarLista(CHAVE_CLIENTES, lista); return c;
        });
      },
      salvarCliente: function (id, dados) {
        return Promise.resolve().then(function () {
          var lista = lerClientes(), c = lista.filter(function (x) { return x.id === id; })[0];
          if (!c) throw erro("Cliente não encontrado.");
          var v = validarCliente(dados);
          if (docEmUso(lista, v.documento, id)) throw erro("Já existe um cliente com esse CPF/CNPJ.", "documento");
          Object.assign(c, v, { updated_at: agora() });
          gravarLista(CHAVE_CLIENTES, lista); return c;
        });
      },
      excluirCliente: function (id) {
        var perfis = ler();
        perfis.forEach(function (p) { if (p.cliente_id === id) p.cliente_id = null; });   // igual a "on delete set null"
        gravarLista(CHAVE, perfis);
        gravarLista(CHAVE_CLIENTES, lerClientes().filter(function (c) { return c.id !== id; }));
        return Promise.resolve();
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Senhas: mínimo de 8 caracteres, com letra e número
  // ---------------------------------------------------------------------------
  function validarSenha(s) {
    s = String(s || "");
    if (s.length < 8) throw erro("A senha precisa ter pelo menos 8 caracteres.", "senha");
    if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) throw erro("Use letras e números na senha.", "senha");
    return s;
  }

  // Mensagens do Supabase Auth em português
  function erroAuth(e, padrao) {
    var code = (e && (e.code || e.error_code)) || "", status = e && e.status;
    var msg = String(e && e.message || "");
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return erro("E-mail ou senha incorretos.");
    if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) return erro("Este e-mail ainda não foi confirmado. Abra o link de confirmação que enviamos.");
    if (code === "over_email_send_rate_limit") return erro("Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.");
    if (code === "over_request_rate_limit" || status === 429) return erro("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    if (code === "weak_password") return erro("Senha fraca. Use pelo menos 8 caracteres, com letras e números.", "senha");
    if (code === "same_password") return erro("A nova senha precisa ser diferente da atual.", "senha");
    if (code === "otp_expired" || /expired|invalid.*token/i.test(msg)) return erro("Este link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\".");
    if (code === "user_banned") return erro("Este usuário está bloqueado.");
    return erro(padrao || "Não foi possível concluir. Tente novamente.");
  }

  // ===========================================================================
  // Supabase
  // ===========================================================================
  function criarSupabase() {
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var SELECT_PERFIL = "*, cliente:clientes(" + CAMPOS_CLIENTE_RESUMO + ")";

    function checar(r, contexto) {
      if (r.error) {
        var c = r.error.code;
        if (c === "23505") throw erro(contexto === "cliente" ? "Já existe um cliente com esse CPF/CNPJ." : "Esse link já está em uso por outro perfil.", contexto === "cliente" ? "documento" : null);
        if (c === "23514") throw erro(contexto === "cliente" ? "Algum dado do cliente está em formato inválido." : "Link inválido. Use letras minúsculas, números e hífen.");
        if (c === "42501" || c === "PGRST301" || r.status === 401 || r.status === 403) throw erro("Sua sessão expirou ou você não tem permissão. Entre novamente.");
        throw erro(r.error.message || "Erro ao acessar o banco de dados.");
      }
      return r.data;
    }
    function caminhoDaUrl(url) {
      var marca = "/storage/v1/object/public/" + BUCKET + "/";
      var i = String(url || "").indexOf(marca);
      return i >= 0 ? decodeURIComponent(url.slice(i + marca.length).split("?")[0]) : null;
    }
    function ehAdmin(user) {
      return sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
        .then(function (a) { return !a.error && !!a.data; });
    }

    return {
      demo: false,
      cliente: sb,
      sessao: function () {
        return sb.auth.getSession().then(function (r) {
          var u = r.data.session && r.data.session.user;
          if (!u) return null;
          return ehAdmin(u).then(function (ok) {
            if (ok) return u;
            return sb.auth.signOut().then(function () { return null; });
          });
        });
      },
      entrar: function (email, senha) {
        return sb.auth.signInWithPassword({ email: String(email || "").trim(), password: senha }).then(function (r) {
          if (r.error) throw erroAuth(r.error, "E-mail ou senha incorretos.");
          return ehAdmin(r.data.user).then(function (ok) {
            if (ok) return r.data.user;
            return sb.auth.signOut().then(function () { throw erro("Este usuário não tem permissão de administrador."); });
          });
        });
      },
      sair: function () { return sb.auth.signOut(); },
      // Sempre responde "enviado" (não revela se o e-mail existe), exceto limite de envios.
      recuperarSenha: function (email) {
        email = String(email || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(erro("Digite um e-mail válido."));
        return sb.auth.resetPasswordForEmail(email, { redirectTo: urlBase() + "/admin/redefinir-senha.html" }).then(function (r) {
          if (r.error && (r.error.status === 429 || /rate_limit/.test(r.error.code || ""))) throw erroAuth(r.error);
        });
      },
      // Confere a senha atual antes de trocar.
      alterarSenha: function (atual, nova) {
        return Promise.resolve().then(function () {
          validarSenha(nova);
          return sb.auth.getUser();
        }).then(function (r) {
          var u = r.data && r.data.user;
          if (!u) throw erro("Sua sessão expirou. Entre novamente.");
          return sb.auth.signInWithPassword({ email: u.email, password: atual });
        }).then(function (r) {
          if (r.error) throw (r.error.code === "invalid_credentials" || /invalid login/i.test(r.error.message || "")) ? erro("Senha atual incorreta.", "atual") : erroAuth(r.error);
          return sb.auth.updateUser({ password: nova });
        }).then(function (r) {
          if (r.error) throw erroAuth(r.error);
          return sb.auth.signOut({ scope: "others" }).then(function () {}, function () {});
        });
      },

      listar: function () {
        return sb.from("perfis").select(SELECT_PERFIL).order("created_at", { ascending: false }).then(checar);
      },
      obter: function (id) {
        return sb.from("perfis").select(SELECT_PERFIL).eq("id", id).maybeSingle().then(checar);
      },
      criar: function (campos) {
        return Promise.resolve().then(function () {
          return sb.from("perfis").insert({
            slug: validarSlug(campos.slug), status: "rascunho",
            cliente_id: campos.cliente_id || null, dados: campos.dados || dadosIniciais()
          }).select(SELECT_PERFIL).single().then(checar);
        });
      },
      salvar: function (id, patch) {
        return Promise.resolve().then(function () {
          if (patch.slug != null) patch.slug = validarSlug(patch.slug);
          return sb.from("perfis").update(patch).eq("id", id).select(SELECT_PERFIL).single().then(checar);
        });
      },
      // Exclui as imagens da pasta do perfil e depois a linha do banco.
      excluir: function (id) {
        var bucket = sb.storage.from(BUCKET);
        return bucket.list(id, { limit: 1000 }).then(function (r) {
          var arquivos = (r.data || []).map(function (f) { return id + "/" + f.name; });
          return arquivos.length ? bucket.remove(arquivos) : null;
        }).then(function () {
          return sb.from("perfis").delete().eq("id", id).then(checar);
        });
      },
      enviarImagem: function (perfilId, blob, tipo) {
        var ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        var caminho = perfilId + "/" + tipo + "-" + Date.now() + "." + ext;
        var bucket = sb.storage.from(BUCKET);
        return bucket.upload(caminho, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false })
          .then(checar)
          .then(function () { return bucket.getPublicUrl(caminho).data.publicUrl; });
      },
      removerImagem: function (url) {
        var c = caminhoDaUrl(url);
        return c ? sb.storage.from(BUCKET).remove([c]).then(function () {}, function () {}) : Promise.resolve();
      },
      perfilPublico: function (slug) {
        return sb.rpc("perfil_publico", { p_slug: String(slug).toLowerCase() }).then(checar);
      },

      listarClientes: function () {
        return sb.from("clientes").select("*, perfis(count)").order("nome").then(function (r) {
          return (checar(r, "cliente") || []).map(function (c) {
            var t = c.perfis && c.perfis[0] ? c.perfis[0].count : 0;
            delete c.perfis;
            return Object.assign(c, { total_perfis: t });
          });
        });
      },
      obterCliente: function (id) {
        return sb.from("clientes").select("*").eq("id", id).maybeSingle().then(function (r) { return checar(r, "cliente"); });
      },
      criarCliente: function (dados) {
        return Promise.resolve().then(function () {
          return sb.from("clientes").insert(validarCliente(dados)).select().single().then(function (r) { return checar(r, "cliente"); });
        });
      },
      salvarCliente: function (id, dados) {
        return Promise.resolve().then(function () {
          return sb.from("clientes").update(validarCliente(dados)).eq("id", id).select().single().then(function (r) { return checar(r, "cliente"); });
        });
      },
      excluirCliente: function (id) {
        return sb.from("clientes").delete().eq("id", id).then(function (r) { return checar(r, "cliente"); });
      }
    };
  }

  function urlBase() { return (cfg.dominio || location.origin).replace(/\/+$/, ""); }

  var db = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase ? criarSupabase() : criarDemo();
  db.validarSlug = validarSlug;
  db.gerarSlug = gerarSlug;
  db.validarCliente = validarCliente;
  db.validarSenha = validarSenha;
  db.erroAuth = erroAuth;
  db.soDigitos = soDigitos;
  db.REDES_CLIENTE = REDES_CLIENTE;
  db.UFS = UFS;
  db.urlPerfil = function (slug) { return urlBase() + "/" + slug; };
  window.DB = db;
})();
