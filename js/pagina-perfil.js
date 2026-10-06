/* Página pública do perfil: nfcliente.com.br/<link> (ou perfil.html?p=<link> para testes). */
(function () {
  var app = document.getElementById("app");
  // seudominio.com/joao  ->  "joao"   (ou perfil.html?p=joao para testes)
  var slug = new URLSearchParams(location.search).get("p") ||
             decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "");
  if (/\.html?$/i.test(slug)) slug = "";

  function aviso(icone, titulo, texto) {
    document.title = titulo;
    Perfil.renderAviso(app, icone, titulo, texto);
  }

  if (!/^[a-z0-9-]{1,40}$/i.test(slug)) {
    aviso("fa-solid fa-link-slash", "Página não encontrada", "Confira o endereço e tente de novo.");
    return;
  }

  DB.perfilPublico(slug).then(function (r) {
    if (!r) return aviso("fa-solid fa-link-slash", "Página não encontrada", "Confira o endereço e tente de novo.");
    if (r.status === "inativo") return aviso("fa-solid fa-circle-pause", "Perfil temporariamente indisponível", "Este perfil está fora do ar no momento.");
    if (r.status !== "ativo") return aviso("fa-solid fa-screwdriver-wrench", "Em breve", "Este perfil está sendo configurado.");

    var d = r.dados || {};
    document.title = d.nome || "Links";
    var desc = document.createElement("meta");
    desc.name = "description"; desc.content = (d.descricao || "").split("\n")[0];
    document.head.appendChild(desc);
    Perfil.render(app, d, { urlPublica: DB.urlPerfil(slug) });
  }).catch(function () {
    aviso("fa-solid fa-wifi", "Não foi possível carregar", "Verifique sua conexão e tente novamente.");
  });
})();
