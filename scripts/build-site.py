#!/usr/bin/env python3
"""Gera site/index.html (documento completo) a partir de behold-movement.html.

behold-movement.html é escrito no formato de Artifact (sem <!doctype>, <head>
ou <body>). Este script move <title>, fontes e <style> para o <head>, adiciona
metadados de SEO/compartilhamento e grava o resultado em site/index.html.

Uso: python3 scripts/build-site.py
"""
import base64
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "behold-movement.html"
OUT = ROOT / "site" / "index.html"

SITE_URL = "https://beholdmovement.com.br/"
DESCRIPTION = (
    "Behold Movement: um movimento interdenominacional para revelar Cristo às "
    "pessoas em Taboão da Serra, Embu das Artes e Itapecerica da Serra. "
    "Inscreva-se para o Dia 31."
)
FAVICON = (
    "data:image/svg+xml,"
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
    "%3Crect width='64' height='64' rx='8' fill='%231f5bf2'/%3E"
    "%3Ctext x='32' y='50' text-anchor='middle' font-family='Impact,Arial Narrow,sans-serif' "
    "font-size='46' fill='%2316171c'%3EB%3C/text%3E%3C/svg%3E"
)


def main() -> None:
    src = SRC.read_text(encoding="utf-8")
    cut = src.index("</style>") + len("</style>")
    head_part, body_part = src[:cut].strip(), src[cut:].strip()

    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="{DESCRIPTION}">
<meta name="theme-color" content="#1f5bf2">
<link rel="canonical" href="{SITE_URL}">
<link rel="icon" href="{FAVICON}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="{SITE_URL}">
<meta property="og:title" content="Behold Movement · Contemple Cristo">
<meta property="og:description" content="{DESCRIPTION}">
<meta name="twitter:card" content="summary">
{head_part}
</head>
<body>
{body_part}
</body>
</html>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"ok: {OUT.relative_to(ROOT)} ({len(html.encode())} bytes)")
    write_coolify_dockerfile()


def write_coolify_dockerfile() -> None:
    """Dockerfile autocontido para colar no Coolify (recurso "Dockerfile", sem Git).

    O site e a configuração do nginx vão embutidos como um .tar.gz em base64.
    """
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for src, dest in (
            (OUT, "usr/share/nginx/html/index.html"),
            (ROOT / "deploy" / "nginx.conf", "etc/nginx/conf.d/default.conf"),
        ):
            info = tar.gettarinfo(str(src), arcname=dest)
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            info.mode = 0o644
            info.mtime = 0
            with open(src, "rb") as fh:
                tar.addfile(info, fh)
    payload = base64.b64encode(buf.getvalue()).decode()

    dockerfile = f"""# Behold Movement: site estático (gerado por scripts/build-site.py, não editar à mão).
# Coolify: New Resource > Dockerfile (sem Git) > cole este arquivo inteiro.
FROM nginx:1.27-alpine
RUN echo "{payload}" | base64 -d | tar -xz -C /
EXPOSE 80
"""
    path = ROOT / "deploy" / "coolify.Dockerfile"
    path.write_text(dockerfile, encoding="utf-8")
    print(f"ok: {path.relative_to(ROOT)} ({len(dockerfile.encode())} bytes)")


if __name__ == "__main__":
    main()
