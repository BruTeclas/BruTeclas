/* Painel administrativo: login, lista de perfis, editor, ativar/desativar/excluir. */
(function () {
  "use strict";

  var el = Perfil.el, icone = Perfil.icone, TIPOS = Perfil.TIPOS;
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.CONFIG || {};

  var estado = {
    perfis: [],
    filtro: "todos",
    busca: "",
    ed: null            // { orig, p, sujo, imagensNovas: [] }
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
  function nomeDe(p) { return (p.dados && p.dados.nome) || p.cliente_nome || p.slug; }
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
      texto: "Apaga a página, todos os links, as fotos e os dados do cliente \"" + nomeDe(p) + "\".",
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
    if (DB.demo) $("loginErro").textContent = "Modo demonstração: digite qualquer e-mail e senha.";
    $("loginEmail").focus();
  }
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
  function confirmarDescarte() {
    if (!(estado.ed && estado.ed.sujo)) return Promise.resolve(true);
    return confirmar({ titulo: "Descartar alterações?", texto: "Há alterações neste perfil que ainda não foram salvas.", botao: "Descartar", classe: "perigo" });
  }
  $("btnSair").addEventListener("click", function () {
    confirmarDescarte().then(function (sim) {
      if (!sim) return;
      descartarEdicao();
      DB.sair().then(function () { location.hash = ""; mostrarLogin(); });
    });
  });

  function entrarNoApp(usuario) {
    $("telaLogin").hidden = true;
    $("telaApp").hidden = false;
    $("usuarioEmail").textContent = usuario && usuario.email || "";
    rota();
  }

  // ===========================================================================
  // Rotas: #/  (lista)   #/perfil/<id>  (editor)
  // ===========================================================================
  var ignorarHash = false, hashAnterior = location.hash;
  window.addEventListener("hashchange", function () {
    if (ignorarHash) { ignorarHash = false; return; }
    var saindoDoEditor = estado.ed && location.hash !== "#/perfil/" + estado.ed.p.id;
    if (saindoDoEditor && estado.ed.sujo) {
      // Volta para o editor e pergunta; se confirmar, segue para o destino.
      var destino = location.hash;
      ignorarHash = true;
      location.hash = hashAnterior;
      confirmarDescarte().then(function (sim) {
        if (!sim) return;
        descartarEdicao();
        location.hash = destino;
      });
      return;
    }
    if (saindoDoEditor) descartarEdicao();
    hashAnterior = location.hash;
    rota();
  });
  window.addEventListener("beforeunload", function (e) {
    if (estado.ed && estado.ed.sujo) { e.preventDefault(); e.returnValue = ""; }
  });

  function rota() {
    var m = location.hash.match(/^#\/perfil\/([\w-]+)/);
    if (m) abrirEditor(m[1]); else mostrarLista();
  }

  // ===========================================================================
  // Lista
  // ===========================================================================
  function mostrarLista() {
    $("telaEditor").hidden = true;
    $("telaLista").hidden = false;
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
      return [p.slug, p.cliente_nome, p.cliente_contato, p.dados && p.dados.nome].join(" ").toLowerCase().indexOf(b) >= 0;
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
      if (p.cliente_nome && p.cliente_nome !== nomeDe(p)) meta.push(el("span", {}, [icone("fa-regular fa-user"), " " + p.cliente_nome]));
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
  $("btnNovo").addEventListener("click", function () {
    var slugManual = false;
    var nome = el("input", { type: "text", placeholder: "Ex.: Studio Bella Unhas", maxlength: "80" });
    var slug = el("input", { type: "text", placeholder: "studio-bella", maxlength: "40" });
    var erro = el("p", { class: "erro" });
    nome.addEventListener("input", function () { if (!slugManual) slug.value = DB.gerarSlug(nome.value); });
    slug.addEventListener("input", function () { slugManual = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); });
    var btn = el("button", { class: "btn primario", type: "submit" }, [icone("fa-solid fa-plus"), " Criar e configurar"]);
    var form = el("form", {}, [
      el("h2", { text: "Ativar novo perfil" }),
      el("p", { text: "O perfil começa \"em configuração\". Depois de montar a página, clique em \"Liberar para o cliente\"." }),
      el("label", {}, ["Nome do cliente", nome]),
      el("label", {}, ["Link do perfil",
        el("div", { class: "link-publico" }, [el("span", { text: DB.urlPerfil("") }), slug]),
        el("div", { class: "dica", text: "É este endereço que vai gravado no chaveiro. Evite mudar depois." })]),
      erro,
      el("div", { class: "modal-botoes" }, [el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }), btn])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      erro.textContent = "";
      btn.disabled = true;
      DB.criar({ cliente_nome: nome.value.trim(), slug: slug.value }).then(function (p) {
        m.fechar();
        location.hash = "#/perfil/" + p.id;
      }).catch(function (err) {
        erro.textContent = err.amigavel ? err.message : "Erro ao criar: " + err.message;
      }).then(function () { btn.disabled = false; });
    });
    var m = abrirModal([form]);
  });

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
    $("telaLista").hidden = true;
    $("telaEditor").hidden = false;
    $("formEditor").innerHTML = "";
    $("previaTela").innerHTML = "";
    $("edTitulo").textContent = "Carregando…";
    $("edSelo").className = "";
    $("edSelo").textContent = "";
    DB.obter(id).then(function (p) {
      if (!p) { toast("Perfil não encontrado.", true); location.hash = "#/"; return; }
      p.dados = Object.assign({ links: [] }, p.dados || {});
      p.dados.links = (p.dados.links || []).map(function (l) { return l.id ? l : Object.assign({ id: uid() }, l); });
      estado.ed = { orig: clonar(p), p: p, sujo: false, imagensNovas: [], aoMudar: [] };
      desenharEditor();
    }).catch(falhou);
  }

  function editaveis(x) {
    return JSON.stringify([x.slug, x.dados, x.cliente_nome || "", x.cliente_contato || "",
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
      Perfil.render(tela, estado.ed.p.dados, { urlPublica: DB.urlPerfil(estado.ed.p.slug), rodape: false });
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
            { ph: c.ph, classe: (c.k === "mensagem" || (campos.length % 2 === 1 && ci === campos.length - 1)) ? "todo" : null });
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
        itensLinks.push({ l: l, item: item, selo: seloDestaque });
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
      el("div", { class: "dica", style: "margin-top:10px", text: "Os 2 primeiros links da lista aparecem em destaque, como ícones abaixo da descrição. Os demais aparecem como botões, nesta ordem. Use as setas para reordenar. Itens em amarelo estão incompletos e não aparecem." }),
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
      ])
    ]));

    // --- Dados internos ------------------------------------------------------------
    form.appendChild(cartao("fa-solid fa-lock", "Dados internos do cliente", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Só você vê. Não aparece na página." }),
      el("div", { class: "grade" }, [
        campoTexto("Nome do cliente", p.cliente_nome, function (v) { p.cliente_nome = v; marcarSujo(); }),
        campoTexto("Contato (WhatsApp/e-mail)", p.cliente_contato, function (v) { p.cliente_contato = v; marcarSujo(); }),
        campoTexto("Próximo vencimento", p.vencimento ? String(p.vencimento).slice(0, 10) : "", function (v) { p.vencimento = v || null; marcarSujo(); },
          { tipo: "date", dica: "Perfis vencidos ficam destacados na lista (filtro \"Vencidos\")." }),
        campoTexto("Observações", p.observacoes, function (v) { p.observacoes = v; marcarSujo(); }, { classe: "todo", multilinha: true, ph: "Plano, valor, forma de pagamento, nº do chaveiro..." })
      ])
    ]));

    // --- Excluir ---------------------------------------------------------------------
    form.appendChild(cartao("fa-solid fa-triangle-exclamation", "Excluir perfil", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Apaga a página, os links, as fotos e os dados internos. Não pode ser desfeito." }),
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
    var btn = $("btnSalvar");
    btn.disabled = true;
    var p = ed.p, patch = {
      dados: p.dados, cliente_nome: p.cliente_nome || "", cliente_contato: p.cliente_contato || "",
      vencimento: p.vencimento || null, observacoes: p.observacoes || ""
    };
    if (p.slug !== ed.orig.slug) patch.slug = p.slug;
    var antigas = [ed.orig.dados.foto, ed.orig.dados.capa];

    return DB.salvar(p.id, patch).then(function (r) {
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
      if (slugMudou) desenharEditor(); else { cabecalhoEditor(); marcarSujo(); }
      toast("Salvo! ✅");
      return true;
    }).catch(function (e) { falhou(e); return false; })
      .then(function (ok) { btn.disabled = false; return ok; });
  }
  $("btnSalvar").addEventListener("click", salvar);
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && estado.ed) { e.preventDefault(); salvar(); }
  });
  $("btnPrevia").addEventListener("click", function () { $("previa").classList.add("aberta"); });
  $("btnFecharPrevia").addEventListener("click", function () { $("previa").classList.remove("aberta"); });

  // ===========================================================================
  // Início
  // ===========================================================================
  $("nomeMarca").textContent = (cfg.marca || "Painel") + " · Perfis";
  if (DB.demo) $("faixaDemo").hidden = false;
  DB.sessao().then(function (u) { if (u) entrarNoApp(u); else mostrarLogin(); }).catch(mostrarLogin);
})();
