/*
 * Acesso aos dados. Usa o Supabase quando configurado em js/config.js;
 * senão, um "modo demonstração" que guarda tudo no localStorage.
 *
 * Perfil (linha da tabela "perfis"):
 *   { id, slug, status: "rascunho" | "ativo" | "inativo", dados: {...},
 *     cliente_nome, cliente_contato, vencimento, observacoes,
 *     created_at, updated_at }
 */
(function () {
  "use strict";
  var cfg = window.CONFIG || {};
  var BUCKET = "imagens";
  var RESERVADOS = ["admin", "perfil", "js", "css", "img", "api", "assets", "index", "404", "supabase", "login", "www"];

  function erro(msg) { var e = new Error(msg); e.amigavel = true; return e; }

  function validarSlug(slug) {
    slug = String(slug || "").trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug))
      throw erro("O link deve ter de 3 a 40 caracteres: letras minúsculas, números e hífen (sem começar ou terminar com hífen).");
    if (RESERVADOS.indexOf(slug) >= 0) throw erro("Esse link é reservado pelo sistema. Escolha outro.");
    return slug;
  }

  function gerarSlug(texto) {
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  }

  function dadosIniciais(nome) {
    return {
      nome: nome || "", descricao: "", foto: "", capa: "", cor: "#7c3aed", tema: "escuro",
      links: [], mostrarSalvarContato: true, mostrarCompartilhar: true
    };
  }

  // ===========================================================================
  // Modo demonstração (localStorage)
  // ===========================================================================
  // Perfis de exemplo, um em cada situação, criados na primeira vez que o modo demonstração abre.
  function imagemSvg(svg) { return "data:image/svg+xml," + encodeURIComponent(svg); }
  function avatarExemplo(iniciais, c1, c2) {
    return imagemSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<rect width="200" height="200" fill="url(#g)"/><text x="100" y="100" dy=".35em" text-anchor="middle" ' +
      'font-family="Arial,sans-serif" font-size="70" font-weight="700" fill="#fff">' + iniciais + '</text></svg>');
  }
  function diasDaqui(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function exemplosDemo() {
    function perfil(i, slug, status, dados, interno) {
      var data = new Date(Date.now() - i * 864e5).toISOString();
      return Object.assign({
        id: "exemplo-" + slug, slug: slug, status: status,
        dados: Object.assign(dadosIniciais(), dados), created_at: data, updated_at: data
      }, interno);
    }
    return [
      perfil(1, "studio-bella", "ativo", {
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
      }, { cliente_nome: "Bella Souza (exemplo)", cliente_contato: "(19) 99999-9999", vencimento: diasDaqui(18), observacoes: "Plano mensal R$ 19,90 • chaveiro nº 001" }),
      perfil(2, "barbearia-do-joao", "inativo", {
        nome: "Barbearia do João", descricao: "Corte & barba • Desde 2015",
        foto: avatarExemplo("BJ", "#a16207", "#111827"), cor: "#a16207",
        links: [
          { id: "l1", tipo: "whatsapp", numero: "5511988887777" },
          { id: "l2", tipo: "maps", url: "https://maps.google.com/?q=Sao+Paulo" },
          { id: "l3", tipo: "instagram", usuario: "barbeariadojoao" }
        ]
      }, { cliente_nome: "João Lima (exemplo)", cliente_contato: "(11) 98888-7777", vencimento: diasDaqui(-12), observacoes: "Pagamento atrasado. Desativado até regularizar." }),
      perfil(3, "pet-thor", "rascunho", {
        nome: "Thor 🐶", descricao: "Me encontrou? Por favor, chame meu tutor!",
        foto: avatarExemplo("T", "#0ea5e9", "#22c55e"), cor: "#0ea5e9", tema: "claro",
        links: [
          { id: "l1", tipo: "whatsapp", numero: "5521977776666", rotulo: "Avisar o tutor", mensagem: "Oi! Encontrei o Thor." },
          { id: "l2", tipo: "telefone", numero: "+55 21 97777-6666" }
        ]
      }, { cliente_nome: "Ana Costa (exemplo)", cliente_contato: "ana@exemplo.com", vencimento: null, observacoes: "Chaveiro de coleira. Falta a foto do pet." })
    ];
  }

  // ===========================================================================
  // Modo demonstração (localStorage, ou memória se o navegador bloquear)
  // ===========================================================================
  function criarDemo() {
    var CHAVE = "bt_demo_perfis", CHAVE_SESSAO = "bt_demo_sessao";
    var memoria = {};
    var usaLocal = (function () {
      try { localStorage.setItem("bt_teste", "1"); localStorage.removeItem("bt_teste"); return true; } catch (e) { return false; }
    })();
    var guarda = {
      ler: function (k) { return usaLocal ? localStorage.getItem(k) : (k in memoria ? memoria[k] : null); },
      gravar: function (k, v) { if (usaLocal) localStorage.setItem(k, v); else memoria[k] = v; },
      apagar: function (k) { if (usaLocal) localStorage.removeItem(k); else delete memoria[k]; }
    };
    function ler() {
      var bruto = guarda.ler(CHAVE);
      if (bruto === null) { var ex = exemplosDemo(); gravar(ex); return ex; }
      var lista;
      try { lista = JSON.parse(bruto) || []; } catch (e) { return []; }
      // Versões antigas dos exemplos traziam uma imagem de fundo com cor fixa; sem ela,
      // o fundo segue a cor principal.
      var antiga = false;
      lista.forEach(function (p) {
        var c = p.dados && p.dados.capa;
        if (c && c.indexOf("data:image/svg+xml,") === 0 && decodeURIComponent(c.slice(19)).indexOf('<circle cx="330" cy="90" r="190"') >= 0) {
          p.dados.capa = ""; antiga = true;
        }
      });
      if (antiga) gravar(lista);
      return lista;
    }
    function gravar(lista) {
      try { guarda.gravar(CHAVE, JSON.stringify(lista)); }
      catch (e) { throw erro("Espaço do modo demonstração esgotado. Use imagens menores ou configure o Supabase."); }
    }
    function agora() { return new Date().toISOString(); }
    function uuid() { return (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
    function slugEmUso(lista, slug, id) { return lista.some(function (p) { return p.slug === slug && p.id !== id; }); }

    return {
      demo: true,
      sessao: function () { var e = guarda.ler(CHAVE_SESSAO); return Promise.resolve(e ? { email: e } : null); },
      entrar: function (email) { guarda.gravar(CHAVE_SESSAO, email || "demo"); return Promise.resolve({ email: email }); },
      sair: function () { guarda.apagar(CHAVE_SESSAO); return Promise.resolve(); },
      listar: function () {
        return Promise.resolve(ler().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }));
      },
      obter: function (id) { return Promise.resolve(ler().filter(function (p) { return p.id === id; })[0] || null); },
      criar: function (campos) {
        return Promise.resolve().then(function () {
          var lista = ler(), slug = validarSlug(campos.slug);
          if (slugEmUso(lista, slug)) throw erro("O link \"" + slug + "\" já está em uso.");
          var p = {
            id: uuid(), slug: slug, status: "rascunho", dados: dadosIniciais(campos.cliente_nome),
            cliente_nome: campos.cliente_nome || "", cliente_contato: "", vencimento: null, observacoes: "",
            created_at: agora(), updated_at: agora()
          };
          lista.push(p); gravar(lista); return p;
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
          gravar(lista); return p;
        });
      },
      excluir: function (id) {
        gravar(ler().filter(function (p) { return p.id !== id; }));
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
      }
    };
  }

  // ===========================================================================
  // Supabase
  // ===========================================================================
  function criarSupabase() {
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    function checar(r) {
      if (r.error) {
        if (r.error.code === "23505") throw erro("Esse link já está em uso por outro perfil.");
        if (r.error.code === "23514") throw erro("Link inválido. Use letras minúsculas, números e hífen.");
        throw erro(r.error.message || "Erro ao acessar o banco de dados.");
      }
      return r.data;
    }
    function caminhoDaUrl(url) {
      var marca = "/storage/v1/object/public/" + BUCKET + "/";
      var i = String(url || "").indexOf(marca);
      return i >= 0 ? decodeURIComponent(url.slice(i + marca.length).split("?")[0]) : null;
    }

    return {
      demo: false,
      sessao: function () {
        return sb.auth.getSession().then(function (r) { return r.data.session ? r.data.session.user : null; });
      },
      entrar: function (email, senha) {
        return sb.auth.signInWithPassword({ email: email, password: senha }).then(function (r) {
          if (r.error) throw erro("E-mail ou senha incorretos.");
          return sb.from("admins").select("user_id").eq("user_id", r.data.user.id).maybeSingle().then(function (a) {
            if (a.error || !a.data) {
              return sb.auth.signOut().then(function () { throw erro("Este usuário não tem permissão de administrador."); });
            }
            return r.data.user;
          });
        });
      },
      sair: function () { return sb.auth.signOut(); },
      listar: function () {
        return sb.from("perfis").select("*").order("created_at", { ascending: false }).then(checar);
      },
      obter: function (id) {
        return sb.from("perfis").select("*").eq("id", id).maybeSingle().then(checar);
      },
      criar: function (campos) {
        return Promise.resolve().then(function () {
          return sb.from("perfis").insert({
            slug: validarSlug(campos.slug), status: "rascunho",
            cliente_nome: campos.cliente_nome || "", dados: dadosIniciais(campos.cliente_nome)
          }).select().single().then(checar);
        });
      },
      salvar: function (id, patch) {
        return Promise.resolve().then(function () {
          if (patch.slug != null) patch.slug = validarSlug(patch.slug);
          return sb.from("perfis").update(patch).eq("id", id).select().single().then(checar);
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
      }
    };
  }

  var db = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase ? criarSupabase() : criarDemo();
  db.validarSlug = validarSlug;
  db.gerarSlug = gerarSlug;
  db.urlPerfil = function (slug) {
    var base = (cfg.dominio || location.origin).replace(/\/+$/, "");
    return base + "/" + slug;
  };
  window.DB = db;
})();
