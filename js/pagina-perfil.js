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
  // A mesma mensagem para link inexistente, desativado, vencido ou em configuração:
  // quem lê o chaveiro não descobre se um link existe.
  function indisponivel() {
    aviso("fa-solid fa-link-slash", "Perfil indisponível", "Este link não está disponível no momento.");
  }

  if (!/^[a-z0-9-]{1,40}$/i.test(slug)) return indisponivel();

  Publico.perfil(slug).then(function (d) {
    if (!d) return indisponivel();
    document.title = d.nome || "Links";
    var desc = document.createElement("meta");
    desc.name = "description"; desc.content = (d.descricao || "").split("\n")[0];
    document.head.appendChild(desc);
    Perfil.render(app, d, { urlPublica: Publico.urlPerfil(slug) });
  }).catch(function () {
    aviso("fa-solid fa-wifi", "Não foi possível carregar", "Verifique sua conexão e tente novamente.");
  });
})();
