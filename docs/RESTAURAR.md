# Como restaurar o sistema a partir do backup

Cada backup é uma **tag** no GitHub, por exemplo `backup-2026-10-06`. Ela guarda o código e a documentação exatamente como estavam naquele dia.

> **O que a tag NÃO guarda:** os dados do banco (clientes, perfis, fotos) e as configurações dos painéis do Supabase e da Hostinger.
> Os dados de clientes têm CPF, telefone e endereço. **Nunca** os coloque neste repositório, porque ele é público.
> Para os dados, use o backup do próprio Supabase (plano Pro) ou exporte as tabelas `clientes` e `perfis` em CSV pelo *Table Editor* e guarde em local privado.

## 1. Baixar o código da tag

No GitHub: **Code → Tags → backup-AAAA-MM-DD → Download ZIP**. Pelo terminal:

```bash
git clone https://github.com/BruTeclas/BruTeclas.git
cd BruTeclas
git checkout backup-AAAA-MM-DD
```

## 2. Recriar o banco (só se o projeto Supabase for perdido)

1. Crie um projeto novo no Supabase.
2. **SQL Editor:** cole e rode [`supabase/schema.sql`](../supabase/schema.sql). Isso recria tabelas, regras de acesso, funções, o gatilho de administrador e o bucket de imagens.
3. Autorize o seu e-mail com a primeira linha comentada no fim do `schema.sql` e crie o usuário em *Authentication → Users → Add user*.
4. Refaça as configurações do painel, conforme a seção "Supabase: o que falta" do [README](../README.md): cadastro público desligado, URL do site, modelos de e-mail.
5. Atualize `supabaseUrl` e `supabaseAnonKey` em `js/config.js`, com a chave **publicável** do projeto novo.
6. Importe os CSVs de `clientes` e `perfis`, se tiver.

## 3. Publicar o site na Hostinger

```bash
python3 publicar/montar-pacote.py      # gera publicar/nfcliente-site.zip
```

Pelo hPanel: **Sites → nfcliente.com.br → Gerenciador de arquivos**. Envie o `nfcliente-site.zip` para `public_html` e extraia. O `.htaccess` vai junto e já faz `/<link>` abrir o perfil e `/admin` abrir o painel.

## 4. Conferir

- `https://nfcliente.com.br/admin` abre o login e você consegue entrar.
- `https://nfcliente.com.br/<um-link>` mostra o perfil.
- "Esqueci minha senha" envia o e-mail em português.
