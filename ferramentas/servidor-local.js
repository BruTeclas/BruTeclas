#!/usr/bin/env node
// Servidor para testar o site no computador como se estivesse na Hostinger:
// aplica as regras e os cabeçalhos de segurança do .htaccess (/<link> → perfil, /admin, CSP, HSTS…).
//
// Uso (precisa só do Node.js, sem instalar nada):
//   node ferramentas/servidor-local.js          → usa o Supabase de verdade (js/config.js)
//   node ferramentas/servidor-local.js --demo   → modo demonstração: dados só no navegador, nada vai para o banco
// Depois abra http://localhost:3000/admin
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const PORTA = Number(process.env.PORTA) || 3000;
const DEMO = process.argv.includes("--demo");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json" };

// Mesmos bloqueios do .htaccess: arquivos que não fazem parte do site publicado
const BLOQUEADOS = [/(^|\/)\.git(\/|$)/, /^\/(_publicacao|publicar|supabase|ferramentas|docs|README\.md|vercel\.json|_redirects)(\/|$)/];

// Cabeçalhos "Header always set" do .htaccess, relidos a cada pedido para refletir alterações
function cabecalhos() {
  const h = {}, txt = fs.readFileSync(path.join(RAIZ, ".htaccess"), "utf8");
  for (const m of txt.matchAll(/^\s*Header always set ([\w-]+) "((?:[^"\\]|\\.)*)"/gm)) h[m[1]] = m[2];
  return h;
}

function arquivo(caminho) {
  const f = path.join(RAIZ, caminho);
  if (f !== RAIZ && !f.startsWith(RAIZ + path.sep)) return null;   // nunca sai da pasta do projeto
  try {
    const st = fs.statSync(f);
    if (st.isDirectory()) return arquivo(path.join(caminho, "index.html"));
    return st.isFile() ? f : null;
  } catch (e) { return null; }
}

http.createServer(function (req, res) {
  let url;
  try { url = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch (e) { res.writeHead(400); return res.end("400"); }
  const h = cabecalhos();
  if (BLOQUEADOS.some(function (r) { return r.test(url); })) { res.writeHead(404, h); return res.end("404"); }
  if (url === "/admin") { res.writeHead(301, Object.assign({ Location: "/admin/" }, h)); return res.end(); }

  let f = arquivo(url);
  if (!f && /^\/[a-z0-9-]{1,40}\/?$/.test(url)) f = path.join(RAIZ, "perfil.html");   // /<link> abre o perfil
  if (!f) { res.writeHead(404, h); return res.end("404"); }

  h["Content-Type"] = TIPOS[path.extname(f)] || "application/octet-stream";
  if (/\.(html|css|js)$/.test(f)) h["Cache-Control"] = "no-cache";
  let corpo = fs.readFileSync(f);
  if (DEMO && path.relative(RAIZ, f) === path.join("js", "config.js")) {
    // Sem endereço e chave do Supabase, o site entra no modo demonstração
    corpo = corpo.toString("utf8").replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""');
  }
  res.writeHead(200, h);
  res.end(corpo);
}).listen(PORTA, "127.0.0.1", function () {
  console.log("Site em http://localhost:" + PORTA + "/admin" + (DEMO ? "  (modo demonstração: dados só no navegador)" : "  (Supabase de verdade)"));
});
