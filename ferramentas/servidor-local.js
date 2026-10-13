#!/usr/bin/env node
// Servidor para testar o site no computador como se estivesse na Hostinger:
// aplica as regras e os cabeçalhos de segurança dos dois .htaccess (site público e painel).
//
// Uso (precisa só do Node.js, sem instalar nada):
//   node ferramentas/servidor-local.js          → usa o Supabase de verdade (js/config.js)
//   node ferramentas/servidor-local.js --demo   → modo demonstração: dados só no navegador, nada vai para o banco
//
// Endereços:
//   http://localhost:3000/<link>       páginas dos perfis (como nfcliente.com.br/<link>)
//   http://admin.localhost:3000/       painel (como admin.nfcliente.com.br)
//   http://localhost:3000/admin/       atalho só do computador: o mesmo painel no endereço do site.
//                                      No ar, /admin leva para admin.nfcliente.com.br. O atalho permite testar o
//                                      modo demonstração, em que painel e perfis precisam do mesmo endereço.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const PAINEL = path.join(RAIZ, "admin"), CLIENTE = path.join(RAIZ, "cliente");
const PORTA = Number(process.env.PORTA) || 3000;
const DEMO = process.argv.includes("--demo");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json" };

// Mesmos bloqueios do .htaccess do site: arquivos que não fazem parte do site publicado
const BLOQUEADOS = [/(^|\/)\./, /\.php$/, /^\/(_publicacao|publicar|supabase|ferramentas|docs|painel-admin|painel-cliente|README\.md|vercel\.json|_redirects)(\/|$)/];

// Cabeçalhos "Header always set" de um .htaccess, relidos a cada pedido para refletir alterações
function cabecalhos(htaccess) {
  const h = {}, txt = fs.readFileSync(htaccess, "utf8");
  for (const m of txt.matchAll(/^\s*Header always set ([\w-]+) "((?:[^"\\]|\\.)*)"/gm)) h[m[1]] = m[2];
  return h;
}

// Arquivo dentro de "base" (nunca fora dela); pasta → index.html
function arquivo(base, caminho) {
  const f = path.join(base, caminho);
  if (f !== base && !f.startsWith(base + path.sep)) return null;
  try {
    const st = fs.statSync(f);
    if (st.isDirectory()) return arquivo(base, path.join(caminho, "index.html"));
    return st.isFile() ? f : null;
  } catch (e) { return null; }
}

// Painel: a pasta admin/ é a raiz; js/ e css/ vêm do projeto (como em painel-admin/ no pacote)
function arquivoDoPainel(caminho) {
  if (/^\/(js|css)\//.test(caminho)) return arquivo(RAIZ, caminho);
  return arquivo(PAINEL, caminho);
}

function enviar(res, f, h) {
  h["Content-Type"] = TIPOS[path.extname(f)] || "application/octet-stream";
  if (/\.(html|css|js)$/.test(f)) h["Cache-Control"] = "no-cache";
  let corpo = fs.readFileSync(f);
  if (DEMO && f === path.join(RAIZ, "js", "config.js")) {
    // Sem endereço e chave do Supabase, o site entra no modo demonstração
    corpo = corpo.toString("utf8").replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""');
  }
  res.writeHead(200, h);
  res.end(corpo);
}

http.createServer(function (req, res) {
  let url;
  try { url = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch (e) { res.writeHead(400); return res.end("400"); }
  const painel = /^admin\./i.test(req.headers.host || ""), cliente = /^cliente\./i.test(req.headers.host || "");
  const naoAchou = function (h) { res.writeHead(404, h); res.end("404"); };

  if (painel) {
    // admin.localhost: como admin.nfcliente.com.br (admin/.htaccess)
    const h = cabecalhos(path.join(PAINEL, ".htaccess"));
    if (/(^|\/)\.(?!well-known\/acme-challenge\/)|\.php$/.test(url)) return naoAchou(h);
    const antigo = /^\/admin(?:\/+(.*))?$/.exec(url);
    if (antigo) {
      // Como no .htaccess: destino sempre neste endereço ("/admin//outro-site" não sai daqui)
      const q = req.url.indexOf("?") >= 0 ? req.url.slice(req.url.indexOf("?")) : "";
      res.writeHead(301, Object.assign({ Location: "http://" + req.headers.host + "/" + (antigo[1] || "").replace(/^\/+/, "") + q }, h));
      return res.end();
    }
    const f = arquivoDoPainel(url);
    return f ? enviar(res, f, h) : naoAchou(h);
  }

  if (cliente || url === "/cliente" || url.startsWith("/cliente/")) {
    // cliente.localhost (como cliente.nfcliente.com.br) ou o atalho localhost/cliente/
    if (url === "/cliente") { res.writeHead(301, { Location: "/cliente/" }); return res.end(); }
    const h = cabecalhos(path.join(CLIENTE, ".htaccess")), u = cliente ? url : url.slice("/cliente".length);
    if (/(^|\/)\.(?!well-known\/acme-challenge\/)|\.php$/.test(u)) return naoAchou(h);
    const f = /^\/(js|css)\/|^\/admin\/admin\.css$/.test(u) ? arquivo(RAIZ, u) : arquivo(CLIENTE, u);
    return f ? enviar(res, f, h) : naoAchou(h);
  }

  // localhost: como nfcliente.com.br (.htaccess da raiz)
  if (url === "/admin") { res.writeHead(301, { Location: "/admin/" }); return res.end(); }
  if (url.startsWith("/admin/")) {
    // Atalho do computador: o painel no mesmo endereço do site
    const h = cabecalhos(path.join(PAINEL, ".htaccess"));
    if (/(^|\/)\.(?!well-known\/acme-challenge\/)|\.php$/.test(url)) return naoAchou(h);
    const f = arquivo(PAINEL, url.slice("/admin".length));
    return f ? enviar(res, f, h) : naoAchou(h);
  }
  const h = cabecalhos(path.join(RAIZ, ".htaccess"));
  if (BLOQUEADOS.some(function (r) { return r.test(url); })) return naoAchou(h);
  let f = arquivo(RAIZ, url);
  if (!f && /^\/[a-z0-9-]{1,40}\/?$/.test(url)) f = path.join(RAIZ, "perfil.html");   // /<link> abre o perfil
  return f ? enviar(res, f, h) : naoAchou(h);
}).listen(PORTA, "127.0.0.1", function () {
  console.log((DEMO ? "Modo demonstração (dados só no navegador)" : "Supabase de verdade") + "\n" +
    "  Perfis: http://localhost:" + PORTA + "/<link>\n" +
    "  Painel: http://admin.localhost:" + PORTA + "/   (ou http://localhost:" + PORTA + "/admin/)\n" +
    "  Cliente: http://cliente.localhost:" + PORTA + "/#<código>   (ou http://localhost:" + PORTA + "/cliente/#<código>)");
});
