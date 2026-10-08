# Site estático do Behold Movement (usado pelo Coolify quando o deploy vem do Git).
# Para publicar sem Git, use deploy/coolify.Dockerfile (gerado por scripts/build-site.py).
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
EXPOSE 80
