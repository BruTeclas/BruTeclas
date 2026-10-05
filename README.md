# BruTeclas · Perfis para chaveiros NFC

Sistema para criar e gerenciar páginas de links ("link na bio") para clientes.
Cada cliente ganha um endereço próprio, por exemplo `bruteclas.com.br/studio-bella`,
que é gravado no chaveiro. Quando alguém aproxima o chaveiro do celular, a página abre.

## Como funciona

```
                ┌──────────────────────────────┐
 Chaveiro NFC → │ bruteclas.com.br/studio-bella │ → perfil.html busca o perfil "studio-bella"
                └──────────────────────────────┘          │
                                                           ▼
 Você → bruteclas.com.br/admin (login) ──────────► Supabase (banco + fotos)
        cria, edita, ativa, desativa, exclui
```

- **Site (gratuito):** arquivos estáticos no Netlify ou Vercel, com o seu domínio.
- **Banco e fotos (gratuito):** [Supabase](https://supabase.com) guarda os perfis, as imagens e o seu login.
- O endereço do chaveiro **nunca muda**. Você altera links, fotos e situação pelo painel e a página atualiza na hora.

### Situação de cada perfil

| Situação | O que o visitante vê | Quando usar |
|---|---|---|
| **Em configuração** | "Em breve" | Logo após "Ativar novo perfil", enquanto você monta a página |
| **No ar** | A página completa | Depois de clicar em "Liberar para o cliente" |
| **Desativado** | "Perfil temporariamente indisponível" | Pagamento atrasado. **Nada é apagado** e dá para reativar com um clique |
| **Excluído** | "Página não encontrada" | Apaga página, links, fotos e dados internos, **sem volta**. Pede para digitar o link como confirmação |

### O que dá para configurar em cada perfil

- Foto de perfil e foto de fundo (redimensionadas automaticamente).
- Cor principal e tema escuro ou claro.
- Nome e descrição.
- Links, na ordem que você quiser. **Os 2 primeiros da lista aparecem em destaque**, como ícones abaixo da descrição; os demais aparecem como botões:
  - **WhatsApp** com mensagem pronta.
  - **Pix** com QR Code e Copia e Cola.
  - **Google:** avaliar, Maps e perfil da empresa.
  - **Contato:** e-mail, telefone e site.
  - **Link personalizado**, com ícone à sua escolha.
  - **16 redes sociais:** Instagram, TikTok, Facebook, YouTube, LinkedIn, X, Threads, Kwai e outras.
- Botões "Salvar contato" e "Compartilhar".
- **Dados internos** (só você vê): nome e contato do cliente, data de vencimento e observações. Perfis vencidos ficam destacados e têm um filtro próprio.
- QR Code do perfil para imprimir no verso do chaveiro.

## Testar agora (modo demonstração)

Sem nada configurado, o painel funciona em **modo demonstração**: os dados ficam salvos só no seu navegador.

```bash
npx serve .          # ou: python3 -m http.server
```
Abra `http://localhost:3000/admin`, entre com qualquer e-mail e senha e crie um perfil.
Para ver a página pública localmente, use `http://localhost:3000/perfil.html?p=<link>`.

## Colocar no ar (passo a passo, ~20 min)

### 1. Supabase (banco de dados)
1. Crie uma conta em [supabase.com](https://supabase.com) → **New project** (região *South America (São Paulo)*).
2. **SQL Editor** → New query → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Users → Add user**: crie o seu usuário (e-mail e senha) e marque *Auto Confirm User*.
4. Volte ao **SQL Editor** e rode, com o seu e-mail:
   ```sql
   insert into public.admins (user_id)
     select id from auth.users where email = 'SEU_EMAIL_AQUI';
   ```
5. **Authentication → Sign In / Providers → Email**: **desative "Allow new users to sign up"**.
   Assim ninguém consegue criar conta. Só entra quem você cadastrar.
6. **Project Settings → API**: copie a *Project URL* e a *anon public key*.

### 2. Configurar o site
Edite [`js/config.js`](js/config.js):
```js
supabaseUrl: "https://xxxx.supabase.co",
supabaseAnonKey: "eyJ...",
dominio: "https://bruteclas.com.br",
```
> A *anon key* é pública por natureza; quem protege os dados são as regras do banco.
> **Nunca** coloque a *service_role key* no site.

### 3. Hospedar (Netlify ou Vercel, grátis)
- **Netlify:** *Add new site → Import from GitHub* → escolha este repositório → Deploy.
  O arquivo `_redirects` já faz `seudominio.com/<link>` abrir o perfil certo.
- **Vercel:** *Add New → Project* → importe o repositório → Deploy. O `vercel.json` já faz o mesmo.

Depois, em **Domain settings**, adicione o seu domínio e siga as instruções de DNS do seu registrador (Registro.br, Hostinger etc.).

> GitHub Pages **não** serve aqui: ele não consegue mandar `/<link>` para a página do perfil.

### 4. Gravar o chaveiro
1. No painel: **Ativar novo perfil** → configure → **Liberar para o cliente**.
2. Copie o link do perfil.
3. No app **NFC Tools** (Android ou iPhone): *Escrever → Adicionar registro → URL* → cole o link → *Escrever* → encoste o chaveiro.
4. Teste com o celular. Depois, se quiser, trave a tag em *Outras → Bloquear tag*. É irreversível, mas como o link nunca muda isso não atrapalha.

> ⚠️ Use chaveiros **NFC NTAG213, 215 ou 216 (13,56 MHz)**. Chaveiros RFID de **125 kHz**, de portaria,
> **não** são lidos por celular.

## Estrutura dos arquivos

```
index.html            Página inicial do domínio (sua vitrine; personalize)
perfil.html           Página pública de cada perfil (/<link>)
admin/                Painel com login
  index.html, admin.js, admin.css
js/config.js          ← suas chaves do Supabase e o domínio
js/db.js              Acesso ao banco (Supabase ou modo demonstração)
js/perfil-render.js   Desenha a página do perfil, gera o Pix e o vCard
css/perfil.css        Visual da página do perfil
supabase/schema.sql   Tabelas, regras de segurança e armazenamento de fotos
_redirects            Rotas para o Netlify
vercel.json           Rotas para a Vercel
```

## Segurança

- Visitantes só conseguem ler **um perfil pelo link exato** e **apenas se estiver no ar**. Não dá para listar perfis nem ver dados internos (função `perfil_publico`).
- Criar, editar e excluir exige login **e** estar na tabela `admins`.
- Só administradores enviam ou apagam fotos.

## Próximas ideias

- **Estatísticas:** quantas vezes cada chaveiro foi lido.
- **Login do cliente**, para ele editar os próprios links (plano "Pro").
- **Desativação automática** de perfis com vencimento atrasado há X dias.
- **Cobrança automática:** link do Mercado Pago ou Asaas que reativa o perfil ao pagar.
- **Modelos prontos** por segmento: salão, restaurante, pet (coleira), emergência médica, corretor.
- **Vários links por cliente**, como os chaveiros da equipe de uma empresa.
