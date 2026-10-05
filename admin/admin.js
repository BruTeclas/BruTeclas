/* Painel administrativo: login (com recuperação e troca de senha), perfis (lista, editor,
   ativar/desativar/excluir) e clientes (cadastro completo, ligado aos perfis). */
(function () {
  "use strict";

  var el = Perfil.el, icone = Perfil.icone, TIPOS = Perfil.TIPOS;
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.CONFIG || {};

  var estado = {
    perfis: [],
    filtro: "todos",
    busca: "",
    ed: null,           // editor de perfil: { orig, p, sujo, imagensNovas: [] }
    cl: null,           // cadastro de cliente: { id, c, orig, rota, sujo }
    clientes: [],
    buscaClientes: ""
  };

  var CORES = ["#7c3aed", "#e11d74", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#2563eb", "#111827", "#a16207", "#be185d"];
  var GRUPOS_LINKS = [
    ["Principais", ["whatsapp", "pix", "telefone", "email", "site", "link"]],
    ["Google", ["google_avaliar", "maps", "google_perfil"]],
    ["Redes sociais", Object.keys(TIPOS).filter(function (k) { return TIPOS[k].grupo === "rede"; })]
  ];
  var TEXTO_STATUS = {
    ativo: ["No ar", "O cliente e qualquer pessoa que ler o chaveiro veem a página."],
    inativo: ["Desativado", "Fora do ar. Quem acessar vê \"Perfil temporariamente indisponível\". Nada foi apagado."],
    rascunho: ["Em configuração", "Ainda não liberado. Quem acessar vê \"Em breve\"."]
  };

  // ===========================================================================
  // Utilitários
  // ===========================================================================
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(msg, ehErro) {
    var t = $("toastAdmin");
    t.textContent = msg;
    t.className = "toast-admin ver" + (ehErro ? " erro-t" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = "toast-admin"; }, ehErro ? 5000 : 2600);
  }
  function falhou(e) {
    console.error(e);
    toast(e && e.amigavel ? e.message : "Algo deu errado: " + (e && e.message || e), true);
  }
  function dataBR(iso) { if (!iso) return ""; var p = String(iso).slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function hojeISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function vencido(p) { return p.vencimento && String(p.vencimento).slice(0, 10) < hojeISO(); }
  function nomeDe(p) { return (p.dados && p.dados.nome) || (p.cliente && p.cliente.nome) || p.slug; }
  function selo(status) { return el("span", { class: "selo " + status, text: TEXTO_STATUS[status][0] }); }
  function uid() { return Math.random().toString(36).slice(2, 10); }

  function campoTexto(rotulo, valor, aoMudar, extra) {
    extra = extra || {};
    var input = el(extra.multilinha ? "textarea" : "input", {
      type: extra.multilinha ? null : (extra.tipo || "text"), placeholder: extra.ph || "", maxlength: extra.max || null
    });
    input.value = valor || "";
    input.addEventListener("input", function () { aoMudar(input.value); });
    return el("label", { class: extra.classe || null }, [rotulo, input, extra.dica ? el("div", { class: "dica", text: extra.dica }) : null]);
  }

  // ---------------------------------------------------------------------------
  // Modais
  // ---------------------------------------------------------------------------
  function abrirModal(filhos, aoFechar) {
    var fundo = el("div", { class: "modal-fundo" });
    var caixa = el("div", { class: "modal", role: "dialog", "aria-modal": "true" }, filhos);
    fundo.appendChild(caixa);
    function fechar() { fundo.remove(); document.removeEventListener("keydown", esc); if (aoFechar) aoFechar(); }
    function esc(e) { if (e.key === "Escape") fechar(); }
    fundo.addEventListener("mousedown", function (e) { if (e.target === fundo) fechar(); });
    document.addEventListener("keydown", esc);
    $("modais").appendChild(fundo);
    var foco = caixa.querySelector("input, button.primario, button.perigo, button.verde");
    if (foco) setTimeout(function () { foco.focus(); }, 30);
    return { fechar: fechar, caixa: caixa };
  }

  // opcoes: { titulo, texto, botao, classe, exigir (texto que precisa ser digitado), alerta }
  function confirmar(o) {
    return new Promise(function (ok) {
      var resolvido = false, m;
      var digitado = o.exigir ? el("input", { type: "text", placeholder: o.exigir, autocomplete: "off" }) : null;
      var btnOk = el("button", { class: "btn " + (o.classe || "primario"), type: "button", text: o.botao || "Confirmar" });
      if (digitado) {
        btnOk.disabled = true;
        digitado.addEventListener("input", function () { btnOk.disabled = digitado.value.trim().toLowerCase() !== o.exigir; });
        digitado.addEventListener("keydown", function (e) { if (e.key === "Enter" && !btnOk.disabled) btnOk.click(); });
      }
      btnOk.addEventListener("click", function () { resolvido = true; m.fechar(); ok(true); });
      m = abrirModal([
        el("h2", { text: o.titulo }),
        el("p", { text: o.texto }),
        o.alerta ? el("div", { class: "alerta" }, [icone("fa-solid fa-triangle-exclamation"), " ", o.alerta]) : null,
        digitado ? el("label", {}, ["Para confirmar, digite ", el("code", { text: o.exigir }), digitado]) : null,
        el("div", { class: "modal-botoes" }, [
          el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }),
          btnOk
        ])
      ], function () { if (!resolvido) ok(false); });
    });
  }

  function mostrarQR(p) {
    var url = DB.urlPerfil(p.slug);
    var caixa = el("div", { class: "qr-caixa" });
    var m = abrirModal([
      el("h2", { text: "QR Code do perfil" }),
      el("p", { text: "Imprima no verso do chaveiro ou na embalagem, para quem estiver com o NFC desligado." }),
      caixa,
      el("div", { class: "qr-link", text: url }),
      el("div", { class: "modal-botoes" }, [
        el("button", { class: "btn", type: "button", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy"), " Copiar link"]),
        el("button", { class: "btn primario", type: "button", onclick: function () {
          var c = caixa.querySelector("canvas");
          var a = el("a", { href: c ? c.toDataURL("image/png") : caixa.querySelector("img").src, download: "qrcode-" + p.slug + ".png" });
          document.body.appendChild(a); a.click(); a.remove();
        } }, [icone("fa-solid fa-download"), " Baixar PNG"]),
        el("button", { class: "btn fantasma", type: "button", text: "Fechar", onclick: function () { m.fechar(); } })
      ])
    ]);
    if (window.QRCode) new QRCode(caixa, { text: url, width: 1024, height: 1024, correctLevel: QRCode.CorrectLevel.M });
    else caixa.textContent = "Não foi possível carregar o gerador de QR Code.";
  }

  // ===========================================================================
  // Ações de status (usadas na lista e no editor)
  // ===========================================================================
  function mudarStatus(p, novo) {
    var c;
    if (novo === "ativo" && p.status === "rascunho") {
      if (!(p.dados && p.dados.nome)) { toast("Preencha pelo menos o nome exibido antes de liberar.", true); return Promise.resolve(null); }
      c = { titulo: "Liberar perfil para o cliente?", texto: "A página " + DB.urlPerfil(p.slug) + " passa a funcionar para qualquer pessoa.", botao: "Liberar", classe: "verde" };
    } else if (novo === "ativo") {
      c = { titulo: "Reativar perfil?", texto: "A página volta ao ar imediatamente com todos os links.", botao: "Reativar", classe: "verde" };
    } else {
      c = { titulo: "Desativar perfil?", texto: "A página sai do ar na hora. Quem ler o chaveiro verá \"Perfil temporariamente indisponível\". Nenhum dado é apagado; dá para reativar quando quiser.", botao: "Desativar", classe: "perigo" };
    }
    return confirmar(c).then(function (sim) {
      if (!sim) return null;
      return DB.salvar(p.id, { status: novo }).then(function (r) {
        toast(novo === "ativo" ? "Perfil no ar! ✅" : "Perfil desativado.");
        return r;
      });
    }).catch(function (e) { falhou(e); return null; });
  }

  function excluirPerfil(p) {
    return confirmar({
      titulo: "Excluir perfil permanentemente?",
      texto: "Apaga a página \"" + nomeDe(p) + "\", todos os links e as fotos. O cadastro do cliente continua.",
      alerta: "Não dá para desfazer. Se for só falta de pagamento, use \"Desativar\".",
      exigir: p.slug, botao: "Excluir para sempre", classe: "perigo"
    }).then(function (sim) {
      if (!sim) return false;
      return DB.excluir(p.id).then(function () { toast("Perfil excluído."); return true; });
    }).catch(function (e) { falhou(e); return false; });
  }

  // ===========================================================================
  // Login / sessão
  // ===========================================================================
  function mostrarLogin() {
    $("telaApp").hidden = true;
    $("telaLogin").hidden = false;
    mostrarFormLogin(location.hash === "#esqueci");
    if (DB.demo) $("loginErro").textContent = "Modo demonstração: digite qualquer e-mail e senha.";
    if (DB.indisponivel) $("loginErro").textContent = DB.indisponivel;
  }
  function mostrarFormLogin(recuperar) {
    $("formLogin").hidden = !!recuperar;
    $("formRecuperar").hidden = !recuperar;
    if (recuperar) {
      if (!$("recuperarEmail").value) $("recuperarEmail").value = $("loginEmail").value;
      $("recuperarErro").textContent = "";
      $("recuperarEmail").focus();
    } else $("loginEmail").focus();
  }
  $("btnEsqueci").addEventListener("click", function () { mostrarFormLogin(true); });
  $("btnVoltarLogin").addEventListener("click", function () { if (location.hash === "#esqueci") history.replaceState(null, "", "#/"); mostrarFormLogin(false); });
  $("formRecuperar").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = this.querySelector("button[type=submit]");
    btn.disabled = true;
    $("recuperarErro").textContent = "";
    $("recuperarOk").hidden = true;
    DB.recuperarSenha($("recuperarEmail").value).then(function () {
      $("recuperarOk").textContent = DB.demo
        ? "Modo demonstração: nenhum e-mail é enviado."
        : "Se este e-mail tiver acesso ao painel, você vai receber um link em instantes. Confira também a caixa de spam.";
      $("recuperarOk").hidden = false;
      // Evita pedidos repetidos em sequência
      var resta = 60, txt = btn.innerHTML;
      btn.textContent = "Aguarde " + resta + "s";
      var t = setInterval(function () {
        resta--;
        if (resta <= 0) { clearInterval(t); btn.innerHTML = txt; btn.disabled = false; }
        else btn.textContent = "Aguarde " + resta + "s";
      }, 1000);
    }).catch(function (err) {
      $("recuperarErro").textContent = err.amigavel ? err.message : "Não foi possível enviar agora. Tente novamente.";
      btn.disabled = false;
    });
  });
  $("formLogin").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.submitter || this.querySelector("button");
    btn.disabled = true;
    $("loginErro").textContent = "";
    DB.entrar($("loginEmail").value.trim(), $("loginSenha").value).then(function (u) {
      $("loginSenha").value = "";
      entrarNoApp(u);
    }).catch(function (err) {
      $("loginErro").textContent = err.amigavel ? err.message : "Não foi possível entrar.";
    }).then(function () { btn.disabled = false; });
  });
  function haAlteracoes() { return !!((estado.ed && estado.ed.sujo) || (estado.cl && estado.cl.sujo)); }
  function descartarTudo() { descartarEdicao(); estado.cl = null; }
  function confirmarDescarte() {
    if (!haAlteracoes()) return Promise.resolve(true);
    return confirmar({ titulo: "Descartar alterações?", texto: "Há alterações que ainda não foram salvas.", botao: "Descartar", classe: "perigo" });
  }
  $("btnSair").addEventListener("click", function () {
    confirmarDescarte().then(function (sim) {
      if (!sim) return;
      descartarTudo();
      DB.sair().then(function () { history.replaceState(null, "", "#/"); mostrarLogin(); });
    });
  });

  function entrarNoApp(usuario) {
    $("telaLogin").hidden = true;
    $("telaApp").hidden = false;
    $("usuarioEmail").textContent = usuario && usuario.email || "";
    if (location.hash === "#esqueci") history.replaceState(null, "", "#/");
    rota();
  }

  // ---------------------------------------------------------------------------
  // Minha conta: trocar a senha (confere a senha atual)
  // ---------------------------------------------------------------------------
  $("btnConta").addEventListener("click", function () {
    var atual = el("input", { type: "password", autocomplete: "current-password" });
    var nova = el("input", { type: "password", autocomplete: "new-password" });
    var conf = el("input", { type: "password", autocomplete: "new-password" });
    var erroEl = el("p", { class: "erro", role: "alert" });
    var regras = el("ul", { class: "regras-senha" });
    function checar() {
      var v = nova.value;
      regras.innerHTML = "";
      [[v.length >= 8, "Pelo menos 8 caracteres"], [/[A-Za-z]/.test(v) && /\d/.test(v), "Letras e números"],
       [v && v === conf.value, "As duas senhas iguais"]].forEach(function (r) {
        regras.appendChild(el("li", { class: r[0] ? "ok" : null }, [icone(r[0] ? "fa-solid fa-circle-check" : "fa-regular fa-circle"), " " + r[1]]));
      });
    }
    nova.addEventListener("input", checar); conf.addEventListener("input", checar); checar();
    var btn = el("button", { class: "btn primario", type: "submit" }, [icone("fa-solid fa-key"), " Trocar senha"]);
    var form = el("form", {}, [
      el("h2", { text: "Minha conta" }),
      el("p", { text: "Conectado como " + ($("usuarioEmail").textContent || "administrador") + "." }),
      el("label", {}, ["Senha atual", atual]),
      el("label", {}, ["Nova senha", nova]),
      el("label", {}, ["Repita a nova senha", conf]),
      regras, erroEl,
      el("p", { class: "dica", text: "Ao trocar, os outros aparelhos conectados com esta conta são desconectados." }),
      el("div", { class: "modal-botoes" }, [el("button", { class: "btn", type: "button", text: "Fechar", onclick: function () { m.fechar(); } }), btn])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      erroEl.textContent = "";
      if (nova.value !== conf.value) { erroEl.textContent = "As duas senhas novas não são iguais."; conf.focus(); return; }
      btn.disabled = true;
      DB.alterarSenha(atual.value, nova.value).then(function () {
        m.fechar();
        toast(DB.demo ? "Modo demonstração: senha não foi alterada de verdade." : "Senha alterada! ✅");
      }).catch(function (err) {
        erroEl.textContent = err.amigavel ? err.message : "Não foi possível trocar a senha.";
        (err.campo === "atual" ? atual : nova).focus();
      }).then(function () { btn.disabled = false; });
    });
    var m = abrirModal([form]);
  });

  // ===========================================================================
  // Rotas: #/ perfis · #/perfil/<id> · #/clientes · #/cliente/novo · #/cliente/<id>
  // ===========================================================================
  function rotaEmEdicao() {
    if (estado.ed) return "#/perfil/" + estado.ed.p.id;
    if (estado.cl) return estado.cl.rota;
    return null;
  }
  var ignorarHash = false, hashAnterior = location.hash;
  window.addEventListener("hashchange", function () {
    if (ignorarHash) { ignorarHash = false; return; }
    if ($("telaApp").hidden) return;
    var emEdicao = rotaEmEdicao(), saindo = emEdicao && location.hash !== emEdicao;
    if (saindo && haAlteracoes()) {
      // Volta para a tela em edição e pergunta; se confirmar, segue para o destino.
      var destino = location.hash;
      ignorarHash = true;
      location.hash = hashAnterior;
      confirmarDescarte().then(function (sim) {
        if (!sim) return;
        descartarTudo();
        location.hash = destino;
      });
      return;
    }
    if (saindo) descartarTudo();
    hashAnterior = location.hash;
    rota();
  });
  window.addEventListener("beforeunload", function (e) {
    if (haAlteracoes()) { e.preventDefault(); e.returnValue = ""; }
  });

  var TELAS = ["telaLista", "telaEditor", "telaClientes", "telaCliente"];
  function mostrarTela(id) {
    TELAS.forEach(function (t) { $(t).hidden = t !== id; });
    var emClientes = id === "telaClientes" || id === "telaCliente";
    $("abaClientes").classList.toggle("ativa", emClientes);
    $("abaPerfis").classList.toggle("ativa", !emClientes);
    window.scrollTo(0, 0);
  }

  function rota() {
    var h = location.hash, m;
    if ((m = h.match(/^#\/perfil\/([\w-]+)/))) abrirEditor(m[1]);
    else if (h === "#/clientes") mostrarClientes();
    else if ((m = h.match(/^#\/cliente\/([\w-]+)/))) abrirCliente(m[1]);
    else mostrarLista();
  }

  // ===========================================================================
  // Lista
  // ===========================================================================
  function mostrarLista() {
    mostrarTela("telaLista");
    document.title = "Perfis · Painel";
    $("lista").innerHTML = "";
    $("lista").appendChild(el("div", { class: "vazio", text: "Carregando…" }));
    DB.listar().then(function (lista) {
      estado.perfis = lista || [];
      desenharLista();
    }).catch(falhou);
  }

  function desenharLista() {
    var todos = estado.perfis;
    var cont = { ativo: 0, inativo: 0, rascunho: 0 };
    todos.forEach(function (p) { cont[p.status]++; });
    $("resumo").textContent = todos.length + " perfis · " + cont.ativo + " no ar · " + cont.inativo + " desativados · " + cont.rascunho + " em configuração";

    var b = estado.busca.trim().toLowerCase();
    var vis = todos.filter(function (p) {
      if (estado.filtro === "vencidos" && !vencido(p)) return false;
      if (["ativo", "inativo", "rascunho"].indexOf(estado.filtro) >= 0 && p.status !== estado.filtro) return false;
      if (!b) return true;
      var c = p.cliente || {};
      return [p.slug, c.nome, c.telefone, c.whatsapp, c.email, p.dados && p.dados.nome].join(" ").toLowerCase().indexOf(b) >= 0;
    });

    var alvo = $("lista");
    alvo.innerHTML = "";
    if (!todos.length) {
      alvo.appendChild(el("div", { class: "vazio" }, [icone("fa-solid fa-id-card"), "Nenhum perfil ainda. Clique em \"Ativar novo perfil\" para criar o primeiro."]));
      return;
    }
    if (!vis.length) { alvo.appendChild(el("div", { class: "vazio", text: "Nenhum perfil encontrado com esse filtro." })); return; }

    vis.forEach(function (p) {
      var url = DB.urlPerfil(p.slug);
      var foto = p.dados && p.dados.foto;
      var meta = [el("a", { href: url, target: "_blank", rel: "noopener" }, [icone("fa-solid fa-link"), " /" + p.slug])];
      if (p.cliente) meta.push(el("a", { href: "#/cliente/" + p.cliente.id }, [icone("fa-regular fa-user"), " " + p.cliente.nome]));
      if (p.vencimento) meta.push(el("span", { class: vencido(p) ? "vencido" : null }, [icone("fa-regular fa-calendar"), (vencido(p) ? " Venceu " : " Vence ") + dataBR(p.vencimento)]));

      var acoes = [
        el("a", { class: "btn pequeno", href: "#/perfil/" + p.id }, [icone("fa-solid fa-pen"), " Editar"])
      ];
      if (p.status === "ativo") acoes.push(el("button", { class: "btn pequeno perigo-leve", type: "button", onclick: function () { mudarStatus(p, "inativo").then(atualizarItem); } }, [icone("fa-solid fa-circle-pause"), " Desativar"]));
      else acoes.push(el("button", { class: "btn pequeno", type: "button", onclick: function () { mudarStatus(p, "ativo").then(atualizarItem); } }, [icone("fa-solid fa-circle-play"), p.status === "rascunho" ? " Liberar" : " Reativar"]));
      acoes.push(
        el("button", { class: "btn pequeno icone", type: "button", title: "QR Code", "aria-label": "QR Code", onclick: function () { mostrarQR(p); } }, [icone("fa-solid fa-qrcode")]),
        el("button", { class: "btn pequeno icone", type: "button", title: "Copiar link", "aria-label": "Copiar link", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy")]),
        el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Excluir", "aria-label": "Excluir", onclick: function () {
          excluirPerfil(p).then(function (ok) { if (ok) { estado.perfis = estado.perfis.filter(function (x) { return x.id !== p.id; }); desenharLista(); } });
        } }, [icone("fa-solid fa-trash-can")])
      );

      alvo.appendChild(el("div", { class: "item" }, [
        foto ? el("img", { class: "item-foto", src: foto, alt: "" }) : el("div", { class: "item-foto" }, [icone("fa-regular fa-user")]),
        el("div", { class: "item-info" }, [
          el("div", { class: "item-nome" }, [nomeDe(p), selo(p.status)]),
          el("div", { class: "item-meta" }, meta)
        ]),
        el("div", { class: "item-acoes" }, acoes)
      ]));
    });
  }
  function atualizarItem(r) {
    if (!r) return;
    estado.perfis = estado.perfis.map(function (x) { return x.id === r.id ? r : x; });
    desenharLista();
  }

  $("busca").addEventListener("input", function () { estado.busca = this.value; desenharLista(); });
  $("filtroStatus").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    estado.filtro = b.dataset.f;
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle("ativo", c === b); });
    desenharLista();
  });

  // ---------------------------------------------------------------------------
  // Novo perfil
  // ---------------------------------------------------------------------------
  $("btnNovo").addEventListener("click", function () { novoPerfil(null); });

  // Abre o modal de novo perfil. Com um cliente escolhido, a página já nasce com o
  // nome dele e os contatos do cadastro (WhatsApp, e-mail, redes, site, endereço).
  function novoPerfil(clienteId) {
    DB.listarClientes().then(function (clientes) {
      estado.clientes = clientes;
      var slugManual = false, nomeManual = false;
      var sel = el("select");
      sel.appendChild(el("option", { value: "", text: "— Sem cliente —" }));
      clientes.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.nome })); });
      if (clienteId) sel.value = clienteId;
      var nome = el("input", { type: "text", placeholder: "Ex.: Studio Bella Unhas", maxlength: "80" });
      var slug = el("input", { type: "text", placeholder: "studio-bella", maxlength: "40" });
      var importar = el("input", { type: "checkbox" });
      importar.checked = true;
      var linhaImportar = el("label", { class: "interruptor" }, [importar, "Já colocar na página os contatos e redes do cadastro"]);
      var erroEl = el("p", { class: "erro" });
      function clienteEscolhido() { return clientes.filter(function (c) { return c.id === sel.value; })[0] || null; }
      function aoTrocarCliente() {
        var c = clienteEscolhido();
        linhaImportar.hidden = !c;
        if (c && !nomeManual) { nome.value = c.nome.replace(/\s*\(exemplo\)$/, ""); if (!slugManual) slug.value = DB.gerarSlug(nome.value); }
      }
      sel.addEventListener("change", aoTrocarCliente);
      nome.addEventListener("input", function () { nomeManual = true; if (!slugManual) slug.value = DB.gerarSlug(nome.value); });
      slug.addEventListener("input", function () { slugManual = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); });
      var btn = el("button", { class: "btn primario", type: "submit" }, [icone("fa-solid fa-plus"), " Criar e configurar"]);
      var form = el("form", {}, [
        el("h2", { text: "Ativar novo perfil" }),
        el("p", { text: "O perfil começa \"em configuração\". Depois de montar a página, clique em \"Liberar para o cliente\"." }),
        el("label", {}, ["Cliente", sel, el("div", { class: "dica" }, ["Não está na lista? ", el("a", { href: "#/cliente/novo", onclick: function () { m.fechar(); } }, ["Cadastre o cliente primeiro"]), "."])]),
        linhaImportar,
        el("label", {}, ["Nome na página", nome]),
        el("label", {}, ["Link do perfil",
          el("div", { class: "link-publico" }, [el("span", { text: DB.urlPerfil("") }), slug]),
          el("div", { class: "dica", text: "É este endereço que vai gravado no chaveiro. Evite mudar depois." })]),
        erroEl,
        el("div", { class: "modal-botoes" }, [el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }), btn])
      ]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        erroEl.textContent = "";
        btn.disabled = true;
        var c = clienteEscolhido();
        var carregar = c && importar.checked ? DB.obterCliente(c.id) : Promise.resolve(null);
        carregar.then(function (completo) {
          var dados = { nome: nome.value.trim(), descricao: "", foto: "", capa: "", cor: "#7c3aed", tema: "escuro", links: [], mostrarSalvarContato: true, mostrarCompartilhar: true };
          if (completo) dados.links = linksDoCliente(completo, []);
          return DB.criar({ slug: slug.value, cliente_id: c ? c.id : null, dados: dados });
        }).then(function (p) {
          m.fechar();
          location.hash = "#/perfil/" + p.id;
        }).catch(function (err) {
          erroEl.textContent = err.amigavel ? err.message : "Erro ao criar: " + err.message;
        }).then(function () { btn.disabled = false; });
      });
      var m = abrirModal([form]);
      aoTrocarCliente();
    }).catch(falhou);
  }

  // Links de página a partir do cadastro do cliente, sem repetir os que já existem.
  function linksDoCliente(c, existentes) {
    var novos = [], redes = c.redes || {};
    function existe(tipo, campo, valor) {
      return existentes.concat(novos).some(function (l) { return l.tipo === tipo && String(l[campo] || "").replace(/\D/g, "") === String(valor).replace(/\D/g, "") && (campo !== "usuario" || l[campo] === valor); });
    }
    function add(l) { novos.push(Object.assign({ id: uid() }, l)); }
    if (c.whatsapp && !existentes.some(function (l) { return l.tipo === "whatsapp"; })) add({ tipo: "whatsapp", numero: c.whatsapp, mensagem: "Olá! Vim pelo seu chaveiro." });
    if (c.telefone && c.telefone !== c.whatsapp && !existe("telefone", "numero", c.telefone)) add({ tipo: "telefone", numero: "+" + c.telefone });
    if (c.email && !existentes.concat(novos).some(function (l) { return l.tipo === "email" && l.email === c.email; })) add({ tipo: "email", email: c.email });
    DB.REDES_CLIENTE.forEach(function (k) {
      if (k === "site" || !redes[k] || !TIPOS[k]) return;
      if (!existentes.concat(novos).some(function (l) { return l.tipo === k && String(l.usuario || "").replace(/^@/, "") === redes[k]; })) add({ tipo: k, usuario: redes[k] });
    });
    if (redes.site && !existentes.concat(novos).some(function (l) { return l.tipo === "site" && l.url === redes.site; })) add({ tipo: "site", url: redes.site });
    var endereco = [c.logradouro && (c.logradouro + (c.numero ? ", " + c.numero : "")), c.bairro, c.cidade && (c.cidade + (c.uf ? " - " + c.uf : "")), c.cep].filter(Boolean).join(", ");
    if (c.logradouro && c.cidade && !existentes.concat(novos).some(function (l) { return l.tipo === "maps"; }))
      add({ tipo: "maps", url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco) });
    return novos;
  }

  // ===========================================================================
  // Editor
  // ===========================================================================
  function descartarEdicao() {
    var ed = estado.ed;
    if (!ed) return;
    // Remove imagens enviadas nesta edição que não chegaram a ser salvas
    ed.imagensNovas.forEach(function (u) {
      if (u !== ed.orig.dados.foto && u !== ed.orig.dados.capa) DB.removerImagem(u);
    });
    estado.ed = null;
  }

  function abrirEditor(id) {
    mostrarTela("telaEditor");
    $("formEditor").innerHTML = "";
    $("previaTela").innerHTML = "";
    $("edTitulo").textContent = "Carregando…";
    $("edSelo").className = "";
    $("edSelo").textContent = "";
    Promise.all([DB.obter(id), DB.listarClientes()]).then(function (res) {
      var p = res[0];
      estado.clientes = res[1];
      if (!p) { toast("Perfil não encontrado.", true); location.hash = "#/"; return; }
      p.dados = Object.assign({ links: [] }, p.dados || {});
      p.dados.links = (p.dados.links || []).map(function (l) { return l.id ? l : Object.assign({ id: uid() }, l); });
      estado.ed = { orig: clonar(p), p: p, sujo: false, imagensNovas: [], aoMudar: [] };
      desenharEditor();
    }).catch(falhou);
  }

  function editaveis(x) {
    return JSON.stringify([x.slug, x.dados, x.cliente_id || null,
      x.vencimento ? String(x.vencimento).slice(0, 10) : null, x.observacoes || ""]);
  }
  function marcarSujo() {
    var ed = estado.ed;
    ed.sujo = editaveis(ed.p) !== editaveis(ed.orig);
    ed.aoMudar.forEach(function (f) { f(); });
    $("edSalvo").textContent = ed.sujo ? "Alterações não salvas" : "Tudo salvo";
    $("edSalvo").className = "salvo" + (ed.sujo ? " pendente" : "");
    atualizarPrevia();
  }
  var tPrevia;
  function atualizarPrevia() {
    clearTimeout(tPrevia);
    tPrevia = setTimeout(function () {
      if (!estado.ed) return;
      var tela = $("previaTela"), rolagem = tela.scrollTop;
      Perfil.render(tela, estado.ed.p.dados, { urlPublica: DB.urlPerfil(estado.ed.p.slug), mostrarIncompletos: true });
      tela.scrollTop = rolagem;
    }, 120);
  }
  function cabecalhoEditor() {
    var p = estado.ed.p;
    $("edTitulo").textContent = nomeDe(p);
    var s = selo(p.status);
    $("edSelo").replaceWith(s);
    s.id = "edSelo";
    document.title = nomeDe(p) + " · Painel";
  }

  function cartao(iconeC, titulo, filhos, direita) {
    return el("section", { class: "cartao" }, [
      el("div", { class: "cartao-titulo" }, [el("h2", {}, [icone(iconeC), titulo]), direita || null])
    ].concat(filhos));
  }

  function desenharEditor() {
    var ed = estado.ed, p = ed.p, d = p.dados;
    var form = $("formEditor");
    form.innerHTML = "";
    ed.aoMudar = [];
    cabecalhoEditor();

    // --- Status e link ---------------------------------------------------------
    var st = TEXTO_STATUS[p.status];
    var botoesStatus = el("div", { class: "status-botoes" });
    function acaoStatus(novo) {
      var antes = estado.ed.sujo ? salvar() : Promise.resolve(true);
      antes.then(function (ok) {
        if (!ok) return;
        mudarStatus(estado.ed.p, novo).then(function (r) {
          if (!r || !estado.ed) return;
          estado.ed.p.status = estado.ed.orig.status = r.status;
          desenharEditor();
        });
      });
    }
    if (p.status === "rascunho") botoesStatus.appendChild(el("button", { class: "btn verde", type: "button", onclick: function () { acaoStatus("ativo"); } }, [icone("fa-solid fa-rocket"), " Liberar para o cliente"]));
    if (p.status === "inativo") botoesStatus.appendChild(el("button", { class: "btn verde", type: "button", onclick: function () { acaoStatus("ativo"); } }, [icone("fa-solid fa-circle-play"), " Reativar"]));
    if (p.status === "ativo") botoesStatus.appendChild(el("button", { class: "btn perigo", type: "button", onclick: function () { acaoStatus("inativo"); } }, [icone("fa-solid fa-circle-pause"), " Desativar"]));

    var slugInput = el("input", { type: "text", maxlength: "40" });
    slugInput.value = p.slug;
    slugInput.addEventListener("input", function () {
      slugInput.value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      p.slug = slugInput.value;
      marcarSujo();
    });
    var url = DB.urlPerfil(ed.orig.slug);

    form.appendChild(cartao("fa-solid fa-signal", "Situação e link", [
      el("div", { class: "status-caixa " + p.status }, [
        el("div", {}, [el("strong", { text: st[0] }), el("p", { text: st[1] })]),
        botoesStatus
      ]),
      el("label", { style: "margin-top:16px" }, ["Link do perfil (gravado no chaveiro)",
        el("div", { class: "link-publico" }, [el("span", { text: DB.urlPerfil("") }), slugInput]),
        el("div", { class: "dica", text: p.status === "rascunho" ? "Pode ajustar à vontade enquanto estiver em configuração." : "⚠️ Se mudar, o chaveiro já gravado com o link antigo para de funcionar." })
      ]),
      el("div", { class: "status-botoes", style: "margin-top:12px" }, [
        el("a", { class: "btn pequeno", href: url, target: "_blank", rel: "noopener" }, [icone("fa-solid fa-arrow-up-right-from-square"), " Abrir página"]),
        el("button", { class: "btn pequeno", type: "button", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy"), " Copiar link"]),
        el("button", { class: "btn pequeno", type: "button", onclick: function () { mostrarQR(ed.orig); } }, [icone("fa-solid fa-qrcode"), " QR Code"])
      ])
    ]));

    // --- Aparência -------------------------------------------------------------
    var coresBox = el("div", { class: "cores" });
    var corInput = el("input", { type: "color", value: d.cor || "#7c3aed", style: "width:60px" });
    function desenharCores() {
      coresBox.innerHTML = "";
      CORES.forEach(function (c) {
        coresBox.appendChild(el("button", {
          class: "cor-bolinha" + (String(d.cor).toLowerCase() === c ? " sel" : ""), type: "button", title: c, "aria-label": "Cor " + c,
          style: "background:" + c, onclick: function () { d.cor = c; corInput.value = c; desenharCores(); marcarSujo(); }
        }));
      });
    }
    desenharCores();
    corInput.addEventListener("input", function () { d.cor = corInput.value; desenharCores(); marcarSujo(); });

    var tema = el("div", { class: "segmentado" });
    [["escuro", "fa-solid fa-moon", " Escuro"], ["claro", "fa-solid fa-sun", " Claro"]].forEach(function (t) {
      tema.appendChild(el("button", { type: "button", class: (d.tema || "escuro") === t[0] ? "sel" : null, onclick: function () {
        d.tema = t[0];
        Array.prototype.forEach.call(tema.children, function (b) { b.classList.remove("sel"); });
        this.classList.add("sel");
        marcarSujo();
      } }, [icone(t[1]), t[2]]));
    });

    form.appendChild(cartao("fa-solid fa-palette", "Aparência", [
      el("div", { class: "imagens" }, [
        el("div", {}, [el("span", { class: "upload-rotulo", text: "Foto de perfil" }), caixaUpload("foto", "avatar")]),
        el("div", {}, [el("span", { class: "upload-rotulo", text: "Foto de fundo" }), caixaUpload("capa", "capa"),
          el("div", { class: "dica", text: "Sem foto, o fundo usa a cor principal. Com foto, ela fica atrás da página, escurecida para os botões continuarem legíveis." })])
      ]),
      el("div", { class: "grade", style: "margin-top:18px" }, [
        el("div", {}, [el("label", { text: "Cor principal" }), el("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" }, [coresBox, corInput])]),
        el("div", {}, [el("label", { text: "Tema" }), tema])
      ])
    ]));

    // --- Informações -------------------------------------------------------------
    form.appendChild(cartao("fa-solid fa-id-card", "Informações da página", [
      el("div", { class: "grade" }, [
        campoTexto("Nome exibido", d.nome, function (v) { d.nome = v; $("edTitulo").textContent = nomeDe(p); marcarSujo(); }, { classe: "todo", ph: "Nome da pessoa ou empresa", max: 80 }),
        campoTexto("Descrição", d.descricao, function (v) { d.descricao = v; marcarSujo(); }, { classe: "todo", multilinha: true, ph: "Profissão • Cidade\nUma frase sobre o negócio", max: 300, dica: "Pode usar várias linhas e emojis." })
      ])
    ]));

    // --- Links -------------------------------------------------------------------
    var listaLinks = el("div", { class: "links-lista" });
    var adicionar = el("div");
    GRUPOS_LINKS.forEach(function (g) {
      adicionar.appendChild(el("div", { class: "adicionar-grupo", text: g[0] }));
      adicionar.appendChild(el("div", { class: "adicionar" }, g[1].map(function (tipo) {
        return el("button", { type: "button", onclick: function () {
          var novo = { id: uid(), tipo: tipo };
          if (tipo === "pix") { novo.nome = d.nome || ""; }
          if (tipo === "link") { novo.icone = "fa-solid fa-link"; }
          d.links.push(novo);
          desenharLinks(novo.id);
          marcarSujo();
        } }, [icone(TIPOS[tipo].icone), TIPOS[tipo].nome]);
      })));
    });

    // Marca itens incompletos e os que vão em destaque (mesma regra da página).
    var itensLinks = [];
    function atualizarEstadosLinks() {
      var emDestaque = 0;
      itensLinks.forEach(function (x) {
        var valido = !!Perfil.resolverLink(x.l);
        var destaque = valido && emDestaque < Perfil.DESTAQUES;
        if (destaque) emDestaque++;
        x.item.classList.toggle("incompleto", !valido);
        x.item.classList.toggle("destaque", destaque);
        x.selo.hidden = !destaque;
        x.aviso.hidden = valido;
        if (!valido) x.aviso.lastChild.textContent = " Este botão ainda não aparece na página: falta preencher " + Perfil.oQueFalta(x.l) + ".";
      });
    }

    function desenharLinks(focarId) {
      listaLinks.innerHTML = "";
      itensLinks = [];
      if (!d.links.length) listaLinks.appendChild(el("div", { class: "vazio", style: "padding:24px", text: "Nenhum link ainda. Escolha abaixo o que adicionar." }));
      d.links.forEach(function (l, i) {
        var t = TIPOS[l.tipo];
        if (!t) return;
        var campos = t.campos.slice();
        if (l.tipo !== "link") campos.push({ k: "rotulo", rotulo: "Texto do botão (opcional)", ph: t.titulo || t.nome });
        var item = el("div", { class: "link-item" });
        var seloDestaque = el("span", { class: "link-destaque", title: "Aparece como ícone abaixo da descrição" }, [icone("fa-solid fa-star"), el("span", { class: "link-destaque-texto", text: "Destaque" })]);

        var ic = el("span", { class: "link-ic" }, [icone(l.tipo === "link" && l.icone ? l.icone : t.icone)]);
        if (t.cor) ic.style.background = t.cor;
        if (t.corIcone) ic.style.color = t.corIcone;
        var corpo = el("div", { class: "link-corpo" });
        campos.forEach(function (c, ci) {
          if (c.tipo === "icone") {
            var sel = el("select");
            Perfil.ICONES.forEach(function (o) { var op = el("option", { value: o[0], text: o[1] }); if (l.icone === o[0]) op.selected = true; sel.appendChild(op); });
            sel.addEventListener("change", function () { l.icone = sel.value; ic.replaceChildren(icone(sel.value)); marcarSujo(); });
            corpo.appendChild(el("label", {}, [c.rotulo, sel]));
            return;
          }
          var lab = campoTexto(c.rotulo, l[c.k], function (v) { l[c.k] = v; atualizarEstadosLinks(); marcarSujo(); },
            { ph: c.ph, dica: c.dica, classe: (c.k === "mensagem" || (campos.length % 2 === 1 && ci === campos.length - 1)) ? "todo" : null });
          corpo.appendChild(lab);
        });

        item.appendChild(el("div", { class: "link-cab" }, [
          ic,
          el("span", { class: "link-nome", text: t.nome }),
          seloDestaque,
          el("button", { class: "btn fantasma icone", type: "button", title: "Subir", "aria-label": "Subir", disabled: i === 0 ? "" : null, onclick: function () { mover(i, -1); } }, [icone("fa-solid fa-arrow-up")]),
          el("button", { class: "btn fantasma icone", type: "button", title: "Descer", "aria-label": "Descer", disabled: i === d.links.length - 1 ? "" : null, onclick: function () { mover(i, 1); } }, [icone("fa-solid fa-arrow-down")]),
          el("button", { class: "btn fantasma icone perigo-leve", type: "button", title: "Remover", "aria-label": "Remover", onclick: function () {
            d.links.splice(i, 1); desenharLinks(); marcarSujo();
          } }, [icone("fa-solid fa-trash-can")])
        ]));
        item.appendChild(corpo);
        var aviso = el("div", { class: "link-aviso", role: "status" }, [icone("fa-solid fa-circle-exclamation"), document.createTextNode("")]);
        item.appendChild(aviso);
        itensLinks.push({ l: l, item: item, selo: seloDestaque, aviso: aviso });
        listaLinks.appendChild(item);
        if (l.id === focarId) setTimeout(function () { var f = corpo.querySelector("input"); if (f) { item.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus({ preventScroll: true }); } }, 30);
      });
      atualizarEstadosLinks();
    }
    function mover(i, delta) {
      var j = i + delta;
      if (j < 0 || j >= d.links.length) return;
      var x = d.links[i]; d.links[i] = d.links[j]; d.links[j] = x;
      desenharLinks(); marcarSujo();
    }
    desenharLinks();

    form.appendChild(cartao("fa-solid fa-link", "Links", [
      listaLinks,
      el("div", { class: "dica", style: "margin-top:10px", text: "Os 2 primeiros links completos aparecem em destaque, como ícones abaixo da descrição. Os demais aparecem como botões, nesta ordem. Use as setas para reordenar. Links em amarelo estão incompletos: só aparecem na página depois de preenchidos (na prévia, ficam tracejados)." }),
      adicionar
    ]));

    // --- Opções ------------------------------------------------------------------
    function interruptor(texto, chave) {
      var c = el("input", { type: "checkbox" });
      c.checked = d[chave] !== false;
      c.addEventListener("change", function () { d[chave] = c.checked; marcarSujo(); });
      return el("label", { class: "interruptor" }, [c, texto]);
    }
    form.appendChild(cartao("fa-solid fa-sliders", "Botões extras", [
      el("div", { class: "grade" }, [
        interruptor("Mostrar \"Salvar contato\"", "mostrarSalvarContato"),
        interruptor("Mostrar \"Compartilhar\"", "mostrarCompartilhar")
      ]),
      el("div", { class: "dica", style: "margin-top:10px", text: "Ficam no fim da página. Desmarcados, não aparecem." })
    ]));

    // --- Cliente e cobrança (interno) --------------------------------------------------
    var selCliente = el("select");
    selCliente.appendChild(el("option", { value: "", text: "— Sem cliente —" }));
    estado.clientes.forEach(function (c) { selCliente.appendChild(el("option", { value: c.id, text: c.nome })); });
    selCliente.value = p.cliente_id || "";
    var linkCliente = el("a", { class: "btn pequeno" }, [icone("fa-regular fa-address-card"), " Abrir cadastro"]);
    var btnImportar = el("button", { class: "btn pequeno", type: "button", onclick: function () {
      if (!p.cliente_id) return;
      DB.obterCliente(p.cliente_id).then(function (c) {
        var novos = c ? linksDoCliente(c, d.links) : [];
        if (!novos.length) { toast("A página já tem todos os contatos do cadastro."); return; }
        d.links = d.links.concat(novos);
        desenharLinks();
        marcarSujo();
        toast(novos.length + (novos.length === 1 ? " link adicionado" : " links adicionados") + " no fim da lista.");
      }).catch(falhou);
    } }, [icone("fa-solid fa-file-import"), " Trazer contatos do cadastro"]);
    function atualizarCliente() {
      linkCliente.hidden = btnImportar.hidden = !p.cliente_id;
      if (p.cliente_id) linkCliente.setAttribute("href", "#/cliente/" + p.cliente_id);
    }
    selCliente.addEventListener("change", function () {
      p.cliente_id = selCliente.value || null;
      p.cliente = estado.clientes.filter(function (c) { return c.id === p.cliente_id; })[0] || null;
      atualizarCliente(); marcarSujo();
    });
    atualizarCliente();

    form.appendChild(cartao("fa-solid fa-lock", "Cliente e cobrança", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Só você vê. Não aparece na página." }),
      el("div", { class: "grade" }, [
        el("label", { class: "todo" }, ["Cliente", selCliente,
          el("div", { class: "status-botoes", style: "margin-top:8px" }, [linkCliente, btnImportar, el("a", { class: "btn pequeno fantasma", href: "#/cliente/novo" }, [icone("fa-solid fa-user-plus"), " Novo cliente"])])]),
        campoTexto("Próximo vencimento", p.vencimento ? String(p.vencimento).slice(0, 10) : "", function (v) { p.vencimento = v || null; marcarSujo(); },
          { tipo: "date", dica: "Perfis vencidos ficam destacados na lista (filtro \"Vencidos\")." }),
        campoTexto("Observações", p.observacoes, function (v) { p.observacoes = v; marcarSujo(); }, { classe: "todo", multilinha: true, ph: "Forma de pagamento, nº do chaveiro, combinados..." })
      ])
    ]));

    // --- Excluir ---------------------------------------------------------------------
    form.appendChild(cartao("fa-solid fa-triangle-exclamation", "Excluir perfil", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Apaga a página, os links e as fotos. O cadastro do cliente continua. Não pode ser desfeito." }),
      el("button", { class: "btn perigo", type: "button", onclick: function () {
        excluirPerfil(estado.ed.orig).then(function (ok) {
          if (!ok) return;
          estado.ed.sujo = false;
          estado.ed.imagensNovas = [];
          estado.ed = null;
          location.hash = "#/";
        });
      } }, [icone("fa-solid fa-trash-can"), " Excluir permanentemente"])
    ]));

    marcarSujo();
  }

  // ---------------------------------------------------------------------------
  // Upload de imagem (redimensiona no navegador antes de enviar)
  // ---------------------------------------------------------------------------
  function processarImagem(arquivo, max, quadrado) {
    return new Promise(function (ok, falha) {
      if (!/^image\//.test(arquivo.type)) return falha(Object.assign(new Error("Escolha um arquivo de imagem (JPG, PNG ou WEBP)."), { amigavel: true }));
      var img = new Image(), url = URL.createObjectURL(arquivo);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        if (quadrado) { var lado = Math.min(sw, sh); sx = (sw - lado) / 2; sy = (sh - lado) / 2; sw = sh = lado; }
        var escala = Math.min(1, max / Math.max(sw, sh));
        var c = document.createElement("canvas");
        c.width = Math.round(sw * escala); c.height = Math.round(sh * escala);
        var ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (b && b.type === "image/webp") return ok(b);
          c.toBlob(function (j) { j ? ok(j) : falha(new Error("Não foi possível processar a imagem.")); }, "image/jpeg", 0.85);
        }, "image/webp", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(Object.assign(new Error("Não foi possível abrir essa imagem."), { amigavel: true })); };
      img.src = url;
    });
  }

  function caixaUpload(chave, classe) {
    var d = estado.ed.p.dados;
    var input = el("input", { type: "file", accept: "image/*" });
    var textoPrincipal = el("span", { text: "Clique ou arraste uma imagem" });
    var textoSub = el("small");
    var caixa = el("label", { class: "upload " + classe }, [
      input,
      el("span", { class: "upload-texto" }, [icone("fa-solid fa-camera"), textoPrincipal, textoSub])
    ]);
    var remover = el("button", { class: "upload-remover", type: "button", title: "Remover imagem", "aria-label": "Remover imagem", onclick: function (e) {
      e.preventDefault();
      d[chave] = "";
      atualizar(); marcarSujo();
    } }, [icone("fa-solid fa-xmark")]);
    caixa.appendChild(remover);

    function atualizar() {
      var u = d[chave];
      caixa.style.backgroundImage = u ? "url(\"" + String(u).replace(/"/g, "%22") + "\")" : "";
      caixa.classList.toggle("tem-imagem", !!u);
      remover.hidden = !u;
      if (classe === "capa") {
        // Sem foto, mostra o fundo padrão na cor e no tema atuais
        caixa.classList.toggle("fundo-padrao", !u);
        caixa.classList.toggle("claro", !u && d.tema === "claro");
        caixa.style.setProperty("--cor", d.cor || "#7c3aed");
        textoPrincipal.textContent = u ? "Trocar foto de fundo" : "Sem foto: fundo na cor principal";
        textoSub.textContent = u ? "" : "Clique ou arraste para enviar uma foto";
      }
    }
    if (classe === "capa") estado.ed.aoMudar.push(atualizar);
    function enviar(arquivo) {
      if (!arquivo) return;
      var ed = estado.ed;
      caixa.classList.add("carregando");
      processarImagem(arquivo, classe === "avatar" ? 600 : 1600, classe === "avatar")
        .then(function (blob) { return DB.enviarImagem(ed.p.id, blob, chave); })
        .then(function (u) {
          ed.imagensNovas.push(u);
          if (estado.ed !== ed) return;
          d[chave] = u;
          atualizar(); marcarSujo();
        })
        .catch(falhou)
        .then(function () { caixa.classList.remove("carregando"); input.value = ""; });
    }
    input.addEventListener("change", function () { enviar(input.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { caixa.addEventListener(ev, function (e) { e.preventDefault(); caixa.classList.add("arrastando"); }); });
    ["dragleave", "drop"].forEach(function (ev) { caixa.addEventListener(ev, function (e) { e.preventDefault(); caixa.classList.remove("arrastando"); }); });
    caixa.addEventListener("drop", function (e) { enviar(e.dataTransfer.files[0]); });
    atualizar();
    return caixa;
  }

  // ---------------------------------------------------------------------------
  // Salvar
  // ---------------------------------------------------------------------------
  function salvar() {
    var ed = estado.ed;
    if (!ed) return Promise.resolve(false);
    if (ed.salvando) return ed.salvando;               // Ctrl+S repetido: usa o salvamento em andamento
    var btn = $("btnSalvar");
    btn.disabled = true;
    var p = ed.p, patch = {
      dados: p.dados, cliente_id: p.cliente_id || null,
      vencimento: p.vencimento || null, observacoes: p.observacoes || null
    };
    if (p.slug !== ed.orig.slug) patch.slug = p.slug;
    var antigas = [ed.orig.dados.foto, ed.orig.dados.capa];

    ed.salvando = DB.salvar(p.id, patch).then(function (r) {
      if (estado.ed !== ed) return true;
      // Apaga do armazenamento as imagens que deixaram de ser usadas
      antigas.concat(ed.imagensNovas).forEach(function (u) {
        if (u && u !== p.dados.foto && u !== p.dados.capa) DB.removerImagem(u);
      });
      ed.imagensNovas = [];
      var slugMudou = r.slug !== ed.orig.slug;
      r.dados = p.dados;
      ed.orig = clonar(r);
      ed.p.slug = r.slug;
      ed.p.cliente = r.cliente || null;
      if (slugMudou) desenharEditor(); else { cabecalhoEditor(); marcarSujo(); }
      toast("Salvo! ✅");
      return true;
    }).catch(function (e) { falhou(e); return false; })
      .then(function (ok) { btn.disabled = false; ed.salvando = null; return ok; });
    return ed.salvando;
  }
  $("btnSalvar").addEventListener("click", function () { salvar(); });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && (estado.ed || estado.cl)) { e.preventDefault(); if (estado.ed) salvar(); else salvarCliente(); }
  });
  $("btnPrevia").addEventListener("click", function () { $("previa").classList.add("aberta"); });
  $("btnFecharPrevia").addEventListener("click", function () { $("previa").classList.remove("aberta"); });

  // ===========================================================================
  // Clientes
  // ===========================================================================
  var TEXTO_REDES = {
    instagram: ["Instagram", "fa-brands fa-instagram", "usuario"], facebook: ["Facebook", "fa-brands fa-facebook-f", "usuario ou página"],
    tiktok: ["TikTok", "fa-brands fa-tiktok", "usuario"], youtube: ["YouTube", "fa-brands fa-youtube", "canal"],
    linkedin: ["LinkedIn", "fa-brands fa-linkedin-in", "usuario"], x: ["X (Twitter)", "fa-brands fa-x-twitter", "usuario"],
    kwai: ["Kwai", "fa-solid fa-video", "usuario"], pinterest: ["Pinterest", "fa-brands fa-pinterest-p", "usuario"],
    telegram: ["Telegram", "fa-brands fa-telegram", "usuario"], site: ["Site", "fa-solid fa-globe", "www.exemplo.com.br"]
  };

  // Formatação para exibir (o banco guarda só os números)
  function fmtDoc(v) {
    var d = DB.soDigitos(v);
    if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    return d.slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  function fmtTel(v) {
    var d = DB.soDigitos(v);
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length > 11) return "+" + d;
    if (d.length > 10) return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
    if (d.length > 6) return d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (d.length > 2) return d.replace(/^(\d{2})(\d*)/, "($1) $2");
    return d;
  }
  function fmtCep(v) { var d = DB.soDigitos(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }
  function fmtValor(v) { return v == null || v === "" ? "" : Number(v).toFixed(2).replace(".", ","); }
  function cidadeUF(c) { return [c.cidade, c.uf].filter(Boolean).join("/"); }

  function mostrarClientes() {
    mostrarTela("telaClientes");
    document.title = "Clientes · Painel";
    $("listaClientes").innerHTML = "";
    $("listaClientes").appendChild(el("div", { class: "vazio", text: "Carregando…" }));
    DB.listarClientes().then(function (lista) {
      estado.clientes = lista || [];
      desenharClientes();
    }).catch(falhou);
  }

  function desenharClientes() {
    var todos = estado.clientes, alvo = $("listaClientes");
    var comPerfil = todos.filter(function (c) { return c.total_perfis > 0; }).length;
    $("resumoClientes").textContent = todos.length + (todos.length === 1 ? " cliente" : " clientes") + " · " + comPerfil + " com perfil";
    var b = estado.buscaClientes.trim().toLowerCase(), bd = DB.soDigitos(b);
    var vis = todos.filter(function (c) {
      if (!b) return true;
      var txt = [c.nome, c.email, c.cidade, c.uf, c.plano].join(" ").toLowerCase();
      var nums = [c.documento, c.telefone, c.whatsapp].join(" ");
      return txt.indexOf(b) >= 0 || (bd.length >= 3 && nums.indexOf(bd) >= 0);
    });
    alvo.innerHTML = "";
    if (!todos.length) {
      alvo.appendChild(el("div", { class: "vazio" }, [icone("fa-solid fa-users"), "Nenhum cliente ainda. Clique em \"Novo cliente\" para cadastrar o primeiro."]));
      return;
    }
    if (!vis.length) { alvo.appendChild(el("div", { class: "vazio", text: "Nenhum cliente encontrado com essa busca." })); return; }
    vis.forEach(function (c) {
      var meta = [];
      if (c.whatsapp || c.telefone) meta.push(el("span", {}, [icone(c.whatsapp ? "fa-brands fa-whatsapp" : "fa-solid fa-phone"), " " + fmtTel(c.whatsapp || c.telefone)]));
      if (c.email) meta.push(el("span", {}, [icone("fa-regular fa-envelope"), " " + c.email]));
      if (cidadeUF(c)) meta.push(el("span", {}, [icone("fa-solid fa-location-dot"), " " + cidadeUF(c)]));
      if (c.plano || c.valor_mensal != null) meta.push(el("span", {}, [icone("fa-regular fa-credit-card"), " " + [c.plano, c.valor_mensal != null ? "R$ " + fmtValor(c.valor_mensal) : ""].filter(Boolean).join(" · ")]));
      var iniciais = c.nome.replace(/\(.*?\)/g, "").trim().split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join("").toUpperCase();
      alvo.appendChild(el("div", { class: "item" }, [
        el("div", { class: "item-foto iniciais", text: iniciais }),
        el("div", { class: "item-info" }, [
          el("div", { class: "item-nome" }, [c.nome, el("span", { class: "selo neutro", text: c.total_perfis + (c.total_perfis === 1 ? " perfil" : " perfis") })]),
          el("div", { class: "item-meta" }, meta)
        ]),
        el("div", { class: "item-acoes" }, [
          el("a", { class: "btn pequeno", href: "#/cliente/" + c.id }, [icone("fa-solid fa-pen"), " Editar"]),
          el("button", { class: "btn pequeno", type: "button", onclick: function () { novoPerfil(c.id); } }, [icone("fa-solid fa-plus"), " Perfil"]),
          el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Excluir", "aria-label": "Excluir " + c.nome, onclick: function () {
            excluirCliente(c).then(function (ok) { if (ok) mostrarClientes(); });
          } }, [icone("fa-solid fa-trash-can")])
        ])
      ]));
    });
  }
  $("buscaClientes").addEventListener("input", function () { estado.buscaClientes = this.value; desenharClientes(); });

  function excluirCliente(c) {
    var n = c.total_perfis || 0;
    return confirmar({
      titulo: "Excluir o cliente " + c.nome + "?",
      texto: "Apaga o cadastro (contato, endereço, redes e observações). " +
        (n ? (n === 1 ? "O perfil dele não é apagado: só fica sem cliente ligado." : "Os " + n + " perfis dele não são apagados: só ficam sem cliente ligado.") : "Ele não tem perfis."),
      alerta: "Não dá para desfazer.", botao: "Excluir cliente", classe: "perigo"
    }).then(function (sim) {
      if (!sim) return false;
      return DB.excluirCliente(c.id).then(function () { toast("Cliente excluído."); return true; });
    }).catch(function (e) { falhou(e); return false; });
  }

  // ---------------------------------------------------------------------------
  // Cadastro do cliente
  // ---------------------------------------------------------------------------
  function clienteParaForm(c) {
    c = c || {};
    var redes = {};
    DB.REDES_CLIENTE.forEach(function (k) { redes[k] = (c.redes && c.redes[k]) || ""; });
    return {
      nome: c.nome || "", tipo_pessoa: c.tipo_pessoa || "fisica", documento: c.documento ? fmtDoc(c.documento) : "",
      nascimento: c.nascimento || "", email: c.email || "", telefone: c.telefone ? fmtTel(c.telefone) : "",
      whatsapp: c.whatsapp ? fmtTel(c.whatsapp) : "", cep: c.cep ? fmtCep(c.cep) : "", logradouro: c.logradouro || "",
      numero: c.numero || "", complemento: c.complemento || "", bairro: c.bairro || "", cidade: c.cidade || "", uf: c.uf || "",
      redes: redes, plano: c.plano || "", valor_mensal: fmtValor(c.valor_mensal), observacoes: c.observacoes || ""
    };
  }

  function abrirCliente(id) {
    mostrarTela("telaCliente");
    $("formCliente").innerHTML = "";
    $("clTitulo").textContent = "Carregando…";
    var novo = id === "novo";
    Promise.all([novo ? Promise.resolve(null) : DB.obterCliente(id), novo ? Promise.resolve([]) : DB.listar()]).then(function (res) {
      if (!novo && !res[0]) { toast("Cliente não encontrado.", true); location.hash = "#/clientes"; return; }
      var c = clienteParaForm(res[0]);
      estado.cl = { id: novo ? null : id, c: c, orig: JSON.stringify(c), rota: "#/cliente/" + id, sujo: false,
        perfis: (res[1] || []).filter(function (p) { return p.cliente_id === id; }) };
      desenharCliente();
    }).catch(falhou);
  }

  function marcarClienteSujo() {
    var cl = estado.cl;
    if (!cl) return;
    cl.sujo = JSON.stringify(cl.c) !== cl.orig;
    $("clSalvo").textContent = cl.sujo ? "Alterações não salvas" : (cl.id ? "Tudo salvo" : "");
    $("clSalvo").className = "salvo" + (cl.sujo ? " pendente" : "");
  }

  function desenharCliente() {
    var cl = estado.cl, c = cl.c, form = $("formCliente");
    form.innerHTML = "";
    $("clTitulo").textContent = cl.id ? c.nome || "Cliente" : "Novo cliente";
    document.title = (cl.id ? c.nome : "Novo cliente") + " · Painel";
    var campos = {};

    // campo(chave, rótulo, opções): input ligado a c[chave] (ou c.redes[chave] com rede: true)
    function campo(chave, rotulo, o) {
      o = o || {};
      var alvo = o.rede ? c.redes : c;
      var input = el(o.multilinha ? "textarea" : "input", {
        type: o.multilinha ? null : (o.tipo || "text"), placeholder: o.ph || "", maxlength: o.max || null,
        inputmode: o.inputmode || null, autocomplete: o.autocomplete || "off", id: "cl-" + chave
      });
      input.value = alvo[chave] || "";
      input.addEventListener("input", function () {
        if (o.mascara) { var f = o.mascara(input.value); if (f !== input.value) input.value = f; }
        alvo[chave] = input.value;
        input.classList.remove("invalido");
        if (o.aoMudar) o.aoMudar(input.value);
        marcarClienteSujo();
      });
      campos[chave] = input;
      var rot = o.icone ? [icone(o.icone), " " + rotulo] : [rotulo];
      return el("label", { class: o.classe || null, for: "cl-" + chave }, rot.concat([input, o.dica ? el("div", { class: "dica", text: o.dica }) : null]));
    }

    // --- Dados ---
    var tipo = el("div", { class: "segmentado" });
    var rotDoc = el("span"), rotNasc = el("span"), rotNome = el("span");
    function rotulosTipo() {
      var pj = c.tipo_pessoa === "juridica";
      rotDoc.textContent = pj ? "CNPJ" : "CPF";
      rotNasc.textContent = pj ? "Data de fundação" : "Data de nascimento";
      rotNome.textContent = pj ? "Razão social ou nome fantasia" : "Nome completo";
      if (campos.documento) campos.documento.placeholder = pj ? "00.000.000/0000-00" : "000.000.000-00";
    }
    [["fisica", "Pessoa física"], ["juridica", "Pessoa jurídica"]].forEach(function (t) {
      tipo.appendChild(el("button", { type: "button", class: c.tipo_pessoa === t[0] ? "sel" : null, onclick: function () {
        c.tipo_pessoa = t[0];
        Array.prototype.forEach.call(tipo.children, function (b) { b.classList.remove("sel"); });
        this.classList.add("sel");
        rotulosTipo(); marcarClienteSujo();
      } }, [t[1]]));
    });
    var lNome = campo("nome", "", { max: 120, classe: "todo", aoMudar: function (v) { $("clTitulo").textContent = v || (cl.id ? "Cliente" : "Novo cliente"); } });
    lNome.insertBefore(rotNome, lNome.firstChild);
    var lDoc = campo("documento", "", { mascara: fmtDoc, inputmode: "numeric", max: 18 });
    lDoc.insertBefore(rotDoc, lDoc.firstChild);
    var lNasc = campo("nascimento", "", { tipo: "date" });
    lNasc.insertBefore(rotNasc, lNasc.firstChild);
    rotulosTipo();
    form.appendChild(cartao("fa-regular fa-address-card", "Dados do cliente", [
      el("div", { class: "grade" }, [el("div", { class: "todo" }, [tipo]), lNome, lDoc, lNasc])
    ]));

    // --- Contato ---
    form.appendChild(cartao("fa-solid fa-phone", "Contato", [
      el("div", { class: "grade" }, [
        campo("whatsapp", "WhatsApp", { mascara: fmtTel, inputmode: "tel", ph: "(11) 99999-9999", icone: "fa-brands fa-whatsapp" }),
        campo("telefone", "Telefone", { mascara: fmtTel, inputmode: "tel", ph: "(11) 3333-4444", icone: "fa-solid fa-phone" }),
        campo("email", "E-mail", { tipo: "email", ph: "cliente@exemplo.com", classe: "todo", icone: "fa-regular fa-envelope", inputmode: "email" })
      ])
    ]));

    // --- Endereço (CEP preenche o resto) ---
    var dicaCep = el("div", { class: "dica" });
    var ultimoCep = DB.soDigitos(c.cep);
    function buscarCep(v) {
      var d = DB.soDigitos(v);
      if (d.length !== 8 || d === ultimoCep) return;
      ultimoCep = d;
      dicaCep.textContent = "Buscando endereço…";
      fetch("https://viacep.com.br/ws/" + d + "/json/").then(function (r) { return r.json(); }).then(function (e) {
        if (!estado.cl || estado.cl.c !== c) return;
        if (e.erro) { dicaCep.textContent = "CEP não encontrado. Preencha o endereço à mão."; return; }
        [["logradouro", e.logradouro], ["bairro", e.bairro], ["cidade", e.localidade], ["uf", e.uf]].forEach(function (x) {
          if (!x[1]) return;
          c[x[0]] = x[1];
          if (campos[x[0]]) campos[x[0]].value = x[1];
        });
        dicaCep.textContent = "Endereço preenchido pelo CEP. Confira e complete o número.";
        marcarClienteSujo();
        if (campos.numero && !c.numero) campos.numero.focus();
      }).catch(function () { dicaCep.textContent = "Não foi possível buscar o CEP agora. Preencha o endereço à mão."; });
    }
    var lCep = campo("cep", "CEP", { mascara: fmtCep, inputmode: "numeric", ph: "00000-000", max: 9, aoMudar: buscarCep });
    lCep.appendChild(dicaCep);
    var selUf = el("select", { id: "cl-uf" });
    selUf.appendChild(el("option", { value: "", text: "—" }));
    DB.UFS.forEach(function (u) { selUf.appendChild(el("option", { value: u, text: u })); });
    selUf.value = c.uf || "";
    selUf.addEventListener("change", function () { c.uf = selUf.value; selUf.classList.remove("invalido"); marcarClienteSujo(); });
    campos.uf = { focus: function () { selUf.focus(); }, classList: selUf.classList, set value(v) { selUf.value = v; } };
    form.appendChild(cartao("fa-solid fa-location-dot", "Endereço", [
      el("div", { class: "grade endereco" }, [
        lCep,
        campo("logradouro", "Rua / Avenida", { classe: "todo" }),
        campo("numero", "Número", { max: 20 }),
        campo("complemento", "Complemento", { ph: "Sala, apto, bloco..." }),
        campo("bairro", "Bairro"),
        campo("cidade", "Cidade"),
        el("label", { for: "cl-uf" }, ["UF", selUf])
      ])
    ]));

    // --- Redes sociais ---
    form.appendChild(cartao("fa-solid fa-hashtag", "Redes sociais", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Use só o @usuario (sem o @) ou o link. Dá para trazer tudo para a página do perfil depois." }),
      el("div", { class: "grade" }, DB.REDES_CLIENTE.map(function (k) {
        var t = TEXTO_REDES[k];
        return campo(k, t[0], { rede: true, ph: t[2], icone: t[1], tipo: k === "site" ? "url" : "text" });
      }))
    ]));

    // --- Plano ---
    var lista = el("datalist", { id: "planos" }, ["Mensal", "Trimestral", "Semestral", "Anual", "Pagamento único"].map(function (x) { return el("option", { value: x }); }));
    var lPlano = campo("plano", "Plano", { ph: "Mensal, Anual..." });
    lPlano.querySelector("input").setAttribute("list", "planos");
    form.appendChild(cartao("fa-regular fa-credit-card", "Plano e observações", [
      el("div", { class: "grade" }, [
        lPlano, lista,
        campo("valor_mensal", "Valor (R$)", { inputmode: "decimal", ph: "19,90", mascara: function (v) { return v.replace(/[^\d,.]/g, ""); } }),
        campo("observacoes", "Observações", { multilinha: true, classe: "todo", ph: "Forma de pagamento, preferências, combinados..." })
      ])
    ]));

    // --- Perfis do cliente ---
    if (cl.id) {
      var itens = cl.perfis.map(function (p) {
        return el("div", { class: "perfil-do-cliente" }, [
          el("a", { href: "#/perfil/" + p.id }, [nomeDe(p)]), selo(p.status),
          el("span", { class: "sub", text: "/" + p.slug })
        ]);
      });
      form.appendChild(cartao("fa-solid fa-id-card", "Perfis deste cliente", [
        itens.length ? el("div", { class: "perfis-do-cliente" }, itens) : el("p", { class: "sub", text: "Nenhum perfil ainda." }),
        el("button", { class: "btn", type: "button", style: "margin-top:12px", onclick: function () {
          var ir = function () { novoPerfil(cl.id); };
          if (cl.sujo) salvarCliente().then(function (ok) { if (ok) ir(); }); else ir();
        } }, [icone("fa-solid fa-plus"), " Criar perfil para este cliente"])
      ]));
      form.appendChild(cartao("fa-solid fa-triangle-exclamation", "Excluir cliente", [
        el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Apaga o cadastro. Os perfis dele não são apagados: só ficam sem cliente ligado." }),
        el("button", { class: "btn perigo", type: "button", onclick: function () {
          excluirCliente({ id: cl.id, nome: c.nome, total_perfis: cl.perfis.length }).then(function (ok) {
            if (!ok) return;
            estado.cl = null;
            location.hash = "#/clientes";
          });
        } }, [icone("fa-solid fa-trash-can"), " Excluir cliente"])
      ]));
    }

    form.onsubmit = function (e) { e.preventDefault(); salvarCliente(); };
    cl.campos = campos;
    marcarClienteSujo();
    if (!cl.id) setTimeout(function () { campos.nome.focus(); }, 30);
  }

  function salvarCliente() {
    var cl = estado.cl;
    if (!cl) return Promise.resolve(false);
    if (cl.salvando) return cl.salvando;               // evita criar o mesmo cliente duas vezes
    try { DB.validarCliente(cl.c); }
    catch (e) {
      toast(e.message, true);
      var f = e.campo && cl.campos[e.campo];
      if (f) { f.classList.add("invalido"); f.focus(); }
      return Promise.resolve(false);
    }
    var btn = $("btnSalvarCliente");
    btn.disabled = true;
    var acao = cl.id ? DB.salvarCliente(cl.id, cl.c) : DB.criarCliente(cl.c);
    cl.salvando = acao.then(function (r) {
      if (estado.cl !== cl) return true;
      var eraNovo = !cl.id;
      cl.id = r.id;
      cl.c = clienteParaForm(r);
      cl.orig = JSON.stringify(cl.c);
      cl.sujo = false;
      if (eraNovo) {
        cl.rota = "#/cliente/" + r.id;
        history.replaceState(null, "", cl.rota);
        hashAnterior = cl.rota;
      }
      desenharCliente();
      toast(eraNovo ? "Cliente cadastrado! ✅" : "Salvo! ✅");
      return true;
    }).catch(function (e) {
      falhou(e);
      var f = e.campo && cl.campos[e.campo];
      if (f) { f.classList.add("invalido"); f.focus(); }
      return false;
    }).then(function (ok) { btn.disabled = false; cl.salvando = null; return ok; });
    return cl.salvando;
  }
  $("btnSalvarCliente").addEventListener("click", function () { salvarCliente(); });

  // ===========================================================================
  // Início
  // ===========================================================================
  $("nomeMarca").textContent = (cfg.marca || "Painel") + " · Painel";
  if (DB.demo) $("faixaDemo").hidden = false;
  DB.sessao().then(function (u) { if (u) entrarNoApp(u); else mostrarLogin(); }).catch(mostrarLogin);
})();
