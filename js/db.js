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
  function criarDemo() {
    var CHAVE = "bt_demo_perfis", CHAVE_SESSAO = "bt_demo_sessao";
    function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { return []; } }
    function gravar(lista) {
      try { localStorage.setItem(CHAVE, JSON.stringify(lista)); }
      catch (e) { throw erro("Espaço do modo demonstração esgotado. Use imagens menores ou configure o Supabase."); }
    }
    function agora() { return new Date().toISOString(); }
    function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
    function slugEmUso(lista, slug, id) { return lista.some(function (p) { return p.slug === slug && p.id !== id; }); }

    return {
      demo: true,
      sessao: function () { return Promise.resolve(localStorage.getItem(CHAVE_SESSAO) ? { email: localStorage.getItem(CHAVE_SESSAO) } : null); },
      entrar: function (email) { localStorage.setItem(CHAVE_SESSAO, email || "demo"); return Promise.resolve({ email: email }); },
      sair: function () { localStorage.removeItem(CHAVE_SESSAO); return Promise.resolve(); },
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
