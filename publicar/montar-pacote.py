#!/usr/bin/env python3
"""Gera publicar/nfcliente-site.zip com só os arquivos do site (sem README, SQL etc.).

O pacote tem duas partes, extraídas em public_html na Hostinger:
- raiz: o site público nfcliente.com.br (páginas dos perfis, sem nenhum código de login);
- painel-admin/: o painel, que abre em admin.nfcliente.com.br (pasta do subdomínio).

Uso: python3 publicar/montar-pacote.py
Depois faça commit e peça a publicação (veja "Atualizar o site" no README).
"""
import os
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "publicar", "nfcliente-site.zip")

# (caminho no pacote, arquivo no repositório)
SITE_PUBLICO = [(f, f) for f in [
    "index.html", "perfil.html", ".htaccess",
    "css/perfil.css",
    "js/config.js", "js/perfil-render.js", "js/publico.js", "js/pagina-perfil.js",
    "js/lib/qrcode-1.0.0.min.js",
]]
PAINEL = [("painel-admin/" + destino, origem) for destino, origem in [
    ("index.html", "admin/index.html"), ("admin.js", "admin/admin.js"), ("admin.css", "admin/admin.css"),
    ("redefinir-senha.html", "admin/redefinir-senha.html"), ("redefinir-senha.js", "admin/redefinir-senha.js"),
    (".htaccess", "admin/.htaccess"),
    ("css/perfil.css", "css/perfil.css"),
    ("js/config.js", "js/config.js"), ("js/db.js", "js/db.js"), ("js/perfil-render.js", "js/perfil-render.js"),
    ("js/lib/supabase-js-2.117.2.js", "js/lib/supabase-js-2.117.2.js"), ("js/lib/qrcode-1.0.0.min.js", "js/lib/qrcode-1.0.0.min.js"),
]]
ARQUIVOS = SITE_PUBLICO + PAINEL

with zipfile.ZipFile(DESTINO, "w", zipfile.ZIP_DEFLATED) as z:
    for destino, origem in ARQUIVOS:
        info = zipfile.ZipInfo(destino, date_time=(2026, 1, 1, 0, 0, 0))   # data fixa: mesmo conteúdo, mesmo zip
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        with open(os.path.join(RAIZ, origem), "rb") as f:
            z.writestr(info, f.read())
print("Pacote gerado:", os.path.relpath(DESTINO, RAIZ), os.path.getsize(DESTINO), "bytes,", len(ARQUIVOS), "arquivos",
      "(" + str(len(SITE_PUBLICO)), "do site público +", len(PAINEL), "do painel)")
