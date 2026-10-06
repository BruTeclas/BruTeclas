/* Página do link de "Esqueci minha senha" e do convite: define a nova senha. */
(function () {
  "use strict";
  var cfg = window.CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  // O link pode chegar de dois jeitos:
  //  1) ?token_hash=...&type=recovery|invite  (modelo de e-mail do projeto, à prova de pré-visualização)
  //  2) #access_token=...&type=recovery        (modelo padrão do Supabase)
  // ou com erro: #error_code=otp_expired
  var qs = new URLSearchParams(location.search);
  var hs = new URLSearchParams(location.hash.slice(1));
  var tokenHash = qs.get("token_hash");
  var tipo = qs.get("type") || hs.get("type") || "recovery";
  var codigoErro = qs.get("error_code") || hs.get("error_code");
  // Tira o código da barra de endereço e do histórico
  if (tokenHash || codigoErro) history.replaceState(null, "", location.pathname + (tokenHash ? "?type=" + encodeURIComponent(tipo) : ""));

  if (tipo === "invite") {
    $("titulo").textContent = "Crie sua senha";
    $("subtitulo").textContent = "Você foi convidado para o painel. Crie a senha que vai usar para entrar.";
    document.title = "Criar senha · Painel";
  }

  function aviso(texto, botao, href) {
    $("camposSenha").hidden = true;
    $("aviso").hidden = false;
    $("avisoTexto").textContent = texto;
    $("avisoBotao").textContent = botao;
    $("avisoBotao").href = href;
  }
  var LINK_INVALIDO = "Este link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\".";

  // Regras da senha (as mesmas do painel)
  function checar() {
    var v = $("senha").value, c = $("confirmar").value, r = $("regras");
    r.innerHTML = "";
    [[v.length >= 8, "Pelo menos 8 caracteres"], [/[A-Za-z]/.test(v) && /\d/.test(v), "Letras e números"], [!!v && v === c, "As duas senhas iguais"]]
      .forEach(function (x) {
        var li = document.createElement("li");
        if (x[0]) li.className = "ok";
        var i = document.createElement("i");
        i.className = x[0] ? "fa-solid fa-circle-check" : "fa-regular fa-circle";
        li.appendChild(i);
        li.appendChild(document.createTextNode(" " + x[1]));
        r.appendChild(li);
      });
    return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) && v === c;
  }
  $("senha").addEventListener("input", checar);
  $("confirmar").addEventListener("input", checar);
  $("mostrar").addEventListener("click", function () {
    var s = $("senha"), vis = s.type === "password";
    s.type = $("confirmar").type = vis ? "text" : "password";
    this.firstElementChild.className = vis ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    this.setAttribute("aria-label", vis ? "Esconder senha" : "Mostrar senha");
  });
  checar();

  if (!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase)) {
    aviso("Esta página só funciona com o Supabase configurado (js/config.js).", "Voltar ao painel", "/admin/");
    return;
  }
  if (codigoErro) { aviso(LINK_INVALIDO, "Pedir um novo link", "/admin/#esqueci"); return; }

  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // Sem código na URL, só segue se o link padrão do Supabase já abriu uma sessão de recuperação.
  var pronto = tokenHash ? Promise.resolve(true) : new Promise(function (ok) {
    var feito = false;
    sb.auth.onAuthStateChange(function (evento, sessao) {
      if (feito) return;
      if (evento === "PASSWORD_RECOVERY" || (sessao && hs.get("access_token"))) { feito = true; ok(true); }
    });
    sb.auth.getSession().then(function (r) {
      setTimeout(function () { if (!feito) { feito = true; ok(!!(r.data.session && hs.get("access_token"))); } }, 1500);
    });
  });
  pronto.then(function (temSessao) {
    if (!temSessao) aviso("Abra esta página pelo link que enviamos para o seu e-mail.", "Pedir um link", "/admin/#esqueci");
  });

  function erroAuth(e) {
    var code = (e && e.code) || "", msg = String(e && e.message || "");
    if (code === "weak_password") return "Senha fraca. Use pelo menos 8 caracteres, com letras e números.";
    if (code === "same_password") return "A nova senha precisa ser diferente da anterior.";
    if (code === "otp_expired" || /expired|invalid/i.test(msg)) return LINK_INVALIDO;
    if (e && e.status === 429) return "Muitas tentativas. Aguarde alguns minutos.";
    return "Não foi possível salvar a senha. Tente novamente.";
  }

  $("formSenha").addEventListener("submit", function (e) {
    e.preventDefault();
    $("erro").textContent = "";
    if (!checar()) { $("erro").textContent = "A senha ainda não atende às regras acima."; $("senha").focus(); return; }
    var btn = $("btnSalvar");
    btn.disabled = true;
    // O código do e-mail só é usado aqui, no clique: pré-visualizações de e-mail não o gastam.
    var verificar = tokenHash
      ? sb.auth.verifyOtp({ token_hash: tokenHash, type: tipo === "invite" ? "invite" : "recovery" }).then(function (r) {
          if (r.error) throw r.error;
          tokenHash = null;
        })
      : Promise.resolve();
    verificar.then(function () {
      return sb.auth.updateUser({ password: $("senha").value });
    }).then(function (r) {
      if (r.error) throw r.error;
      // Desconecta outros aparelhos que estivessem usando a senha antiga
      return sb.auth.signOut({ scope: "others" }).catch(function () {});
    }).then(function () {
      aviso(tipo === "invite" ? "Senha criada! Você já pode entrar no painel." : "Senha alterada! Você já pode entrar no painel com a nova senha.", "Ir para o painel", "/admin/");
    }).catch(function (err) {
      var m = erroAuth(err);
      if (m === LINK_INVALIDO) aviso(m, "Pedir um novo link", "/admin/#esqueci");
      else $("erro").textContent = m;
      btn.disabled = false;
    });
  });
})();
