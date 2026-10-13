/*
 * Página do cliente: cliente.nfcliente.com.br/#<código>
 * O cliente digita o PIN (4 últimos dígitos do telefone do cadastro) toda vez que abre o link
 * e edita a própria página com o mesmo editor do painel (js/editor-perfil.js).
 * Tudo passa pelas funções do banco cliente_entrar e cliente_salvar, que conferem o acesso e os dados;
 * as fotos vão pela função cliente-imagem do Supabase. O acesso fica só na memória da aba.
 */
(function () {
  "use strict";
  var el = Perfil.el;
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.CONFIG || {};
  var API = (cfg.supabaseUrl || "").replace(/\/+$/, ""), CHAVE = cfg.supabaseAnonKey || "";
  var codigo = (location.hash || "").slice(1);
  var est = null;   // { sessao, slug, dados, orig, sujo, salvando, salvarDepoisDoPin }

  function toast(msg, ehErro) {
    var t = $("toastAdmin");
    t.textContent = msg;
    t.className = "toast-admin ver" + (ehErro ? " erro-t" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = "toast-admin"; }, ehErro ? 6000 : 3000);
  }
  function amigavel(msg) { return Object.assign(new Error(msg), { amigavel: true }); }
  function falhou(e) { toast(e && e.amigavel ? e.message : "Algo deu errado. Tente de novo.", true); if (window.console) console.error(e); }
  function aviso(titulo, texto) {
    $("formPin").hidden = true; $("telaEditor").hidden = true; $("telaPin").hidden = false;
    $("caixaAviso").hidden = false; $("avisoTitulo").textContent = titulo; $("avisoTexto").textContent = texto;
  }

  function rpc(nome, args) {
    return fetch(API + "/rest/v1/rpc/" + nome, {
      method: "POST", credentials: "omit",
      headers: { "apikey": CHAVE, "Authorization": "Bearer " + CHAVE, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        // Erros de conferência do banco ("Endereço inválido no link 2.") chegam como mensagem
        if (!r.ok) throw r.status === 400 && j && j.message ? amigavel(j.message) : new Error("HTTP " + r.status);
        return j;
      });
    });
  }
  var ERROS_FOTO = { sessao: "Seu acesso expirou. Recarregue a página e digite o PIN de novo.", tamanho: "Imagem muito grande.", formato: "Formato de imagem não aceito. Use JPG, PNG ou WEBP." };
  function enviarImagem(blob, tipo) {
    return fetch(API + "/functions/v1/cliente-imagem", {
      method: "POST", credentials: "omit",
      headers: { "Content-Type": blob.type, "x-sessao": est.sessao, "x-tipo": tipo, "apikey": CHAVE },
      body: blob
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.url) throw amigavel(ERROS_FOTO[j.erro] || "Não foi possível enviar a imagem. Tente de novo.");
        return j.url;
      });
    });
  }

  // ---------------------------------------------------------------------------
  // PIN
  // ---------------------------------------------------------------------------
  var ERROS_PIN = {
    link_invalido: ["Link indisponível", "Este link não vale mais. Peça um novo a quem configurou o seu chaveiro."],
    indisponivel: ["Página fora do ar", "Esta página está fora do ar no momento, então não dá para editar. Fale com quem configurou o seu chaveiro."]
  };
  $("pin").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 4); });
  $("formPin").addEventListener("submit", function (e) {
    e.preventDefault();
    var pin = $("pin").value, btn = $("btnEntrar");
    $("pinErro").textContent = "";
    if (!/^\d{4}$/.test(pin)) { $("pinErro").textContent = "Digite os 4 números."; return; }
    btn.disabled = true;
    rpc("cliente_entrar", { p_codigo: codigo, p_pin: pin }).then(function (j) {
      if (j && j.erro) {
        if (ERROS_PIN[j.erro]) return aviso(ERROS_PIN[j.erro][0], ERROS_PIN[j.erro][1]);
        $("pin").value = "";
        $("pinErro").textContent = j.erro === "bloqueado"
          ? "Muitas tentativas erradas. Tente de novo em " + j.minutos + " minutos."
          : "PIN incorreto." + (j.restantes ? " Restam " + j.restantes + (j.restantes === 1 ? " tentativa." : " tentativas.") : "");
        return;
      }
      entrou(j);
    }).catch(function (err) { $("pinErro").textContent = err.amigavel ? err.message : "Não foi possível entrar. Verifique sua internet e tente de novo."; })
      .then(function () { btn.disabled = false; });
  });

  function entrou(j) {
    var salvarAgora = est && est.salvarDepoisDoPin;
    if (est) {
      // Acesso renovado no meio da edição: mantém o que o cliente já alterou
      est.sessao = j.sessao;
    } else {
      var dados = Object.assign({ links: [] }, j.dados || {});
      dados.links = (dados.links || []).map(function (l, i) { return l.id ? l : Object.assign({ id: "l" + i + Math.random().toString(36).slice(2, 7) }, l); });
      est = { sessao: j.sessao, slug: j.slug, dados: dados, orig: JSON.stringify(dados), sujo: false };
      desenharEditor();
    }
    $("pin").value = "";
    $("telaPin").hidden = true; $("telaEditor").hidden = false;
    if (salvarAgora) { est.salvarDepoisDoPin = false; salvar(); }
  }

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------
  function desenharEditor() {
    var form = $("formEditor"), rolagem = window.scrollY;
    form.innerHTML = "";
    $("btnVerPagina").href = (cfg.dominio || "").replace(/\/+$/, "") + "/" + est.slug;
    form.appendChild(el("p", { class: "sub", style: "margin:0 0 16px", text: "Altere o que quiser e clique em Salvar. A sua página só muda depois de salvar." }));
    EditorPerfil.montar(form, {
      dados: est.dados, marcarSujo: marcarSujo, falhou: falhou, enviarImagem: enviarImagem,
      aoMudarNome: function () { $("edTitulo").textContent = est.dados.nome || "Minha página"; }
    });
    $("edTitulo").textContent = est.dados.nome || "Minha página";
    document.title = (est.dados.nome || "Minha página") + " · Editar";
    marcarSujo();
    window.scrollTo(0, rolagem);
  }
  var tPrevia;
  function marcarSujo() {
    est.sujo = JSON.stringify(est.dados) !== est.orig;
    $("edSalvo").textContent = est.sujo ? "Alterações não salvas" : "Tudo salvo";
    $("edSalvo").className = "salvo" + (est.sujo ? " pendente" : "");
    clearTimeout(tPrevia);
    tPrevia = setTimeout(function () {
      var tela = $("previaTela"), r = tela.scrollTop;
      Perfil.render(tela, est.dados, { urlPublica: (cfg.dominio || "").replace(/\/+$/, "") + "/" + est.slug, mostrarIncompletos: true });
      tela.scrollTop = r;
    }, 120);
  }
  function salvar() {
    if (!est || est.salvando) return;
    var btn = $("btnSalvar");
    btn.disabled = true; est.salvando = true;
    rpc("cliente_salvar", { p_sessao: est.sessao, p_dados: est.dados }).then(function (j) {
      if (j && j.erro === "sessao") {
        // Acesso expirou (2 horas) ou o link foi trocado: pede o PIN de novo e salva em seguida
        est.salvarDepoisDoPin = true;
        $("telaEditor").hidden = true; $("telaPin").hidden = false; $("formPin").hidden = false; $("caixaAviso").hidden = true;
        $("pinTexto").textContent = "Seu acesso expirou. Digite o PIN de novo: suas alterações continuam aqui e serão salvas em seguida.";
        $("pin").focus();
        return;
      }
      // Usa a versão gravada pelo banco (já conferida)
      est.dados = Object.assign({ links: [] }, j.dados);
      est.dados.links = est.dados.links.map(function (l, i) { return l.id ? l : Object.assign({ id: "s" + i + Math.random().toString(36).slice(2, 7) }, l); });
      est.orig = JSON.stringify(est.dados);
      desenharEditor();
      toast("Salvo! Sua página já foi atualizada. ✅");
    }).catch(falhou).then(function () { btn.disabled = false; est.salvando = false; });
  }
  $("btnSalvar").addEventListener("click", salvar);
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && est && !$("telaEditor").hidden) { e.preventDefault(); salvar(); }
  });
  $("btnPrevia").addEventListener("click", function () { $("previa").classList.add("aberta"); });
  $("btnFecharPrevia").addEventListener("click", function () { $("previa").classList.remove("aberta"); });
  window.addEventListener("beforeunload", function (e) { if (est && est.sujo) { e.preventDefault(); e.returnValue = ""; } });

  // ---------------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------------
  if (!API || !CHAVE) aviso("Indisponível", "Esta página só funciona com o Supabase configurado.");
  else if (!/^[A-Za-z0-9_-]{20,100}$/.test(codigo)) aviso("Link incompleto", "Abra o link exatamente como você recebeu, sem cortar nenhuma parte.");
  else $("pin").focus();
})();
