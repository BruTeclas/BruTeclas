/*
 * Leitura pública de um perfil (nfcliente.com.br/<link>).
 *
 * Esta página não carrega a biblioteca de login do Supabase: faz uma única consulta
 * à função public.perfil_publico, que só devolve o conteúdo de perfis no ar.
 * Desativado, vencido, em configuração ou inexistente: a resposta é sempre a mesma (nada).
 */
(function () {
  "use strict";
  var cfg = window.CONFIG || {};
  var configurado = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  function urlBase() { return (cfg.dominio || location.origin).replace(/\/+$/, ""); }

  // Login antigo do painel, de quando ele ficava neste mesmo endereço: não deve ficar guardado aqui.
  function limparSessaoAntiga() {
    try {
      if (!cfg.dominio || location.hostname !== new URL(cfg.dominio).hostname) return;
      Object.keys(localStorage).forEach(function (k) { if (/^sb-.+-auth-token/.test(k)) localStorage.removeItem(k); });
    } catch (e) { /* armazenamento bloqueado: nada a limpar */ }
  }

  // Modo demonstração (sem Supabase): lê os perfis que o painel de demonstração guardou neste navegador,
  // com a mesma regra do banco (no ar e sem vencimento passado da carência de 3 dias).
  function hojeBrasilia() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function vencido(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(String(v == null ? "" : v));
    if (!m) return false;
    var d = new Date(0); d.setUTCFullYear(+m[1], +m[2] - 1, +m[3] + 3);   // vencimento + 3 dias de carência
    var limite = String(d.getUTCFullYear()).padStart(4, "0") + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    return hojeBrasilia() > limite;
  }
  function semDadosDemo() { try { return !localStorage.getItem("bt_demo_perfis"); } catch (e) { return true; } }
  function perfilDemo(slug) {
    var lista;
    try { lista = JSON.parse(localStorage.getItem("bt_demo_perfis") || "[]"); } catch (e) { lista = []; }
    var p = (Array.isArray(lista) ? lista : []).filter(function (x) { return x && x.slug === slug; })[0];
    return p && p.status === "ativo" && !vencido(p.vencimento) ? (p.dados || {}) : null;
  }

  // Devolve os dados do perfil no ar, ou null. Falha de rede: promessa rejeitada.
  function perfil(slug) {
    slug = String(slug || "").toLowerCase();
    if (!configurado) return Promise.resolve(perfilDemo(slug));
    // Mesmos cabeçalhos que a biblioteca oficial envia sem login: a chave pública (publishable)
    return fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/perfil_publico", {
      method: "POST",
      headers: { "apikey": cfg.supabaseAnonKey, "Authorization": "Bearer " + cfg.supabaseAnonKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
      credentials: "omit",
      referrerPolicy: "no-referrer"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      // Só conteúdo de perfil no ar; qualquer outra resposta (inclusive de versões antigas do banco) = indisponível
      return j && j.status === "ativo" && j.dados && typeof j.dados === "object" ? j.dados : null;
    });
  }

  limparSessaoAntiga();
  window.Publico = {
    perfil: perfil, urlPerfil: function (slug) { return urlBase() + "/" + slug; }, demo: !configurado,
    // Modo demonstração sem nenhum perfil guardado neste navegador (o painel de demonstração cria os exemplos)
    semDadosDemo: function () { return !configurado && semDadosDemo(); }
  };
})();
