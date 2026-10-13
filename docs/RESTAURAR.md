# Como restaurar o sistema a partir do backup

Cada versão publicada tem um **ponto de restauração** no GitHub: um branch `versao-X.Y.Z`, por exemplo `versao-1.0.0`. Ele guarda o código, a documentação, o pacote do site e a estrutura do banco exatamente como estavam naquela versão. A lista de versões está em [`HISTORICO.md`](HISTORICO.md).

## Voltar o site para uma versão anterior (o caso mais comum)

Use quando uma versão nova der problema e você quiser o site de antes de volta.

1. **Pegar o pacote da versão:**
   1. No GitHub, abra o repositório e troque o branch para `versao-X.Y.Z`. O seletor fica acima da lista de arquivos.
   2. Abra `publicar/nfcliente-site.zip` e clique em **Download raw file**.
2. **Publicar:**
   1. No hPanel da Hostinger, abra **Sites → nfcliente.com.br → Gerenciador de arquivos**.
   2. Envie o zip para `public_html` e extraia, substituindo os arquivos.

   Ou peça ao Claude: "publique a versão X.Y.Z".
3. **Banco:**
   - Veja em [`HISTORICO.md`](HISTORICO.md) se as versões que você está desfazendo mexeram no banco.
   - Se mexeram, rode no **SQL Editor** do Supabase o script de desfazer de cada uma, da mais nova para a mais antiga. Os scripts ficam em `supabase/versoes/`.
   - Se nenhuma mexeu, não há nada a fazer no banco.
4. **Conferir:** abra `https://nfcliente.com.br/admin` e um perfil, numa aba anônima.

Os dados dos clientes não são apagados ao voltar a versão do site.

## Restaurar tudo do zero

Use se o projeto do Supabase ou a hospedagem forem perdidos.

> **O que o ponto de restauração NÃO guarda:** os dados do banco (clientes, perfis, fotos) e as configurações dos painéis do Supabase e da Hostinger.
> Os dados de clientes têm CPF, telefone e endereço. **Nunca** os coloque neste repositório: mesmo privado, um backup de código não é lugar para dados pessoais.
> Para os dados, use o backup do próprio Supabase (plano Pro) ou exporte as tabelas `clientes` e `perfis` em CSV pelo *Table Editor* e guarde em local privado.

## 1. Baixar o código da versão

No GitHub: troque para o branch `versao-X.Y.Z` → **Code → Download ZIP**. Pelo terminal:

```bash
git clone https://github.com/BruTeclas/NFCliente.git
cd NFCliente
git checkout versao-X.Y.Z
```

## 2. Recriar o banco (só se o projeto Supabase for perdido)

1. Crie um projeto novo no Supabase.
2. **SQL Editor:** cole e rode [`supabase/schema.sql`](../supabase/schema.sql). Isso recria tabelas, regras de acesso, funções, o gatilho de administrador e o bucket de imagens.
3. Autorize o seu e-mail com a primeira linha comentada no fim do `schema.sql` e crie o usuário em *Authentication → Users → Add user*.
4. Refaça as configurações do painel, conforme a seção "Supabase: o que falta" do [README](../README.md): cadastro público e anônimo desligados, "Secure password change" ligado, URL do site, modelos de e-mail.
5. Atualize `supabaseUrl` e `supabaseAnonKey` em `js/config.js`, com a chave **publicável** do projeto novo.
   Troque também o endereço antigo do Supabase (`vomhyqdvxhkovykipxpg.supabase.co`) pelo novo na linha `Content-Security-Policy` do `.htaccess`. Sem isso, o navegador bloqueia o login e as fotos.
6. Importe os CSVs de `clientes` e `perfis`, se tiver.

## 3. Publicar o site na Hostinger

```bash
python3 publicar/montar-pacote.py      # gera publicar/nfcliente-site.zip
```

Pelo hPanel: **Sites → nfcliente.com.br → Gerenciador de arquivos**. Envie o `nfcliente-site.zip` para `public_html` e extraia. O `.htaccess` vai junto e já faz `/<link>` abrir o perfil e `/admin` abrir o painel.

Antes de enviar, se quiser conferir no computador: `node ferramentas/servidor-local.js` e abra `http://localhost:3000/admin`.

## 4. Conferir

- `https://nfcliente.com.br/admin` abre o login e você consegue entrar.
- `https://nfcliente.com.br/<um-link>` mostra o perfil.
- "Esqueci minha senha" envia o e-mail em português.
