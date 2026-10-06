#!/usr/bin/env python3
"""Gera publicar/nfcliente-site.zip com só os arquivos do site (sem README, SQL etc.).

Uso: python3 publicar/montar-pacote.py
Depois faça commit e peça a publicação (veja "Atualizar o site" no README).
"""
import os
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "publicar", "nfcliente-site.zip")
ARQUIVOS = [
    "index.html", "perfil.html", ".htaccess",
    "admin/index.html", "admin/admin.js", "admin/admin.css", "admin/redefinir-senha.html", "admin/redefinir-senha.js",
    "css/perfil.css",
    "js/config.js", "js/db.js", "js/perfil-render.js", "js/pagina-perfil.js",
    "js/vendor/supabase-js-2.117.2.js", "js/vendor/qrcode-1.0.0.min.js",
]

with zipfile.ZipFile(DESTINO, "w", zipfile.ZIP_DEFLATED) as z:
    for nome in ARQUIVOS:
        info = zipfile.ZipInfo(nome, date_time=(2026, 1, 1, 0, 0, 0))   # data fixa: mesmo conteúdo, mesmo zip
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        with open(os.path.join(RAIZ, nome), "rb") as f:
            z.writestr(info, f.read())
print("Pacote gerado:", os.path.relpath(DESTINO, RAIZ), os.path.getsize(DESTINO), "bytes,", len(ARQUIVOS), "arquivos")
