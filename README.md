# BruTeclas · Perfis para chaveiros NFC

Sistema para criar e gerenciar páginas de links ("link na bio") para clientes.
Cada cliente ganha um endereço próprio, por exemplo `nfcliente.com.br/studio-bella`,
que é gravado no chaveiro. Quando alguém aproxima o chaveiro do celular, a página abre.

## Como funciona

```
                ┌──────────────────────────────┐
 Chaveiro NFC → │ nfcliente.com.br/studio-bella │ → perfil.html busca o perfil "studio-bella"
                └──────────────────────────────┘          │
                                                           ▼
 Você → nfcliente.com.br/admin (login) ──────────► Supabase (banco + fotos)
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
- **Cliente e cobrança** (só você vê): cliente ligado ao perfil, data de vencimento e observações. Perfis vencidos ficam destacados e têm um filtro próprio.

### Clientes

Cada cliente tem um cadastro próprio, separado da página. Um cliente pode ter vários perfis.

- **Dados:** pessoa física ou jurídica, nome, CPF/CNPJ (com verificação dos dígitos e sem repetição), data de nascimento ou fundação.
- **Contato:** WhatsApp, telefone e e-mail.
- **Endereço:** o CEP preenche rua, bairro, cidade e UF.
- **Redes sociais e site.**
- **Plano, valor e observações.**

Ao criar um perfil para um cliente, a página já nasce com os contatos do cadastro: WhatsApp, e-mail, redes, site e mapa do endereço. No editor, o botão **"Trazer contatos do cadastro"** completa o que faltar.

### Acesso ao painel

- **Login** só para administradores, com mensagens claras para senha errada, e-mail não confirmado e excesso de tentativas.
- **"Esqueci minha senha"** envia um link por e-mail. A página `admin/redefinir-senha.html` cria a nova senha: mínimo de 8 caracteres, com letras e números.
- **"Minha conta"** troca a senha. A senha atual é conferida antes, e os outros aparelhos são desconectados.
- QR Code do perfil para imprimir no verso do chaveiro.

## Testar no computador

```bash
npx serve .          # ou: python3 -m http.server 3000
```
Abra `http://localhost:3000/admin`. Para ver uma página de perfil, use `http://localhost:3000/perfil.html?p=<link>`.

Com `supabaseUrl` vazio em `js/config.js`, o painel roda em **modo demonstração**: os dados ficam só no navegador e qualquer e-mail e senha entram.

## Supabase: o que já está pronto

O projeto **NFC Ambiente** já está configurado:

- **Banco:** tabelas `admins`, `admins_autorizados`, `clientes` e `perfis`, a função `perfil_publico` e o bucket `imagens`. O conteúdo está em [`supabase/schema.sql`](supabase/schema.sql).
- **Regras de acesso testadas no banco real:**
  - visitante só vê um perfil no ar, pelo link exato;
  - usuário logado que não é administrador não vê nada;
  - administrador vê e grava tudo.
- **E-mail autorizado como administrador:** `bru.teclas@gmail.com`. A conta com esse e-mail vira administradora sozinha quando é criada e confirmada.
- **`js/config.js`** já aponta para o projeto, com a chave **pública** (publishable).

## Supabase: o que falta (só no painel do Supabase, ~10 min)

Essas opções não podem ser mudadas pelo banco. Faça uma vez em [supabase.com/dashboard](https://supabase.com/dashboard), no projeto **NFC Ambiente**:

1. **Authentication → URL Configuration**
   - **Site URL:** o endereço do site, por exemplo `https://nfcliente.com.br`. Enquanto testa no computador, use `http://localhost:3000`.
   - **Redirect URLs:** adicione `https://nfcliente.com.br/admin/redefinir-senha.html` e `http://localhost:3000/admin/redefinir-senha.html`.
2. **Authentication → Sign In / Providers → Email**
   - Desligue **"Allow new users to sign up"**. Ninguém cria conta sozinho; só entra quem você cadastrar.
   - Mantenha **"Confirm email"** ligado.
   - Em **"Minimum password length"**, coloque `8`. Em **"Password requirements"**, escolha letras e números.
3. **Authentication → Emails → Templates.** Para cada modelo, copie o assunto, que está na 1ª linha do arquivo, e cole o conteúdo do arquivo:

   | Modelo | Arquivo |
   |---|---|
   | Reset password | `supabase/templates/recuperar-senha.html` |
   | Invite user | `supabase/templates/convite.html` |
   | Password changed (em *Security notifications*: ligue e cole) | `supabase/templates/senha-alterada.html` |

   Esses modelos levam para `admin/redefinir-senha.html`. O código do link só é usado quando você clica em "Salvar senha", então antivírus de e-mail que abrem links antes de você não o invalidam.
4. **Crie o seu acesso:** **Authentication → Users → Add user → Create new user**, com `bru.teclas@gmail.com`, uma senha forte e **"Auto Confirm User"** marcado. A conta vira administradora sozinha.
   Depois que o site estiver no ar, você também pode usar **"Send invitation"**: chega um e-mail para criar a senha.
5. **E-mail de verdade (recomendado):** o envio padrão do Supabase só entrega para e-mails da equipe do projeto e tem limite por hora. Para você, isso basta. Para mais administradores, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**, por exemplo [Resend](https://resend.com) ou [Brevo](https://www.brevo.com), com remetente como `nao-responda@nfcliente.com.br`.

**Outro administrador:** no **SQL Editor**, rode `insert into public.admins_autorizados (email) values ('email@exemplo.com');` e depois convide o e-mail em **Users → Invite user**.

## Hospedagem (Hostinger: nfcliente.com.br)

O site está publicado na Hostinger, no plano Premium (usuário `u253849728`), com SSL Let's Encrypt ativo e redirecionamento para HTTPS.

- **Regras de endereço:** o `.htaccess` faz `nfcliente.com.br/<link>` abrir o perfil e `/admin` abrir o painel. Ele também tira o `www` e bloqueia arquivos que não são do site.
- **O que vai para o servidor:** só o que está em `publicar/nfcliente-site.zip`. README, SQL e modelos de e-mail ficam de fora.

### Atualizar o site

1. Gere o pacote de novo e faça commit:
   ```bash
   python3 publicar/montar-pacote.py
   git add -A && git commit -m "Atualiza o site" && git push
   ```
2. Na Hostinger, publique o pacote. Pelo hPanel: **Sites → nfcliente.com.br → Gerenciador de arquivos**, envie `nfcliente-site.zip` para `public_html` e extraia.
   Outra opção é pedir ao Claude ("publique de novo na Hostinger"). Ele clona o repositório numa pasta temporária do servidor e publica o pacote, que substitui o conteúdo do site.

> Netlify e Vercel também funcionam: `_redirects` e `vercel.json` têm as mesmas regras. GitHub Pages não serve, porque não consegue mandar `/<link>` para a página do perfil.

## Gravar o chaveiro
1. No painel: **Ativar novo perfil** → configure → **Liberar para o cliente**.
2. Copie o link do perfil.
3. No app **NFC Tools** (Android ou iPhone): *Escrever → Adicionar registro → URL* → cole o link → *Escrever* → encoste o chaveiro.
4. Teste com o celular. Depois, se quiser, trave a tag em *Outras → Bloquear tag*. É irreversível, mas como o link nunca muda isso não atrapalha.

> ⚠️ Use chaveiros **NFC NTAG213, 215 ou 216 (13,56 MHz)**. Chaveiros RFID de **125 kHz**, de portaria,
> **não** são lidos por celular.

## Backup

Cada backup é uma tag `backup-AAAA-MM-DD` no GitHub, com código e documentação. Para restaurar, siga [`docs/RESTAURAR.md`](docs/RESTAURAR.md). Os dados de clientes **não** ficam aqui, porque o repositório é público; o guia explica como guardá-los à parte.

## Estrutura dos arquivos

```
index.html            Página inicial do domínio (sua vitrine; personalize)
perfil.html           Página pública de cada perfil (/<link>)
admin/                Painel com login
  index.html, admin.js, admin.css
  redefinir-senha.html  Página do link "Esqueci minha senha" e do convite
js/config.js          Endereço do Supabase, chave pública e domínio
js/db.js              Acesso ao banco (Supabase ou modo demonstração)
js/perfil-render.js   Desenha a página do perfil, gera o Pix e o vCard
css/perfil.css        Visual da página do perfil
supabase/schema.sql   Tabelas, regras de segurança e armazenamento de fotos
supabase/templates/   Modelos de e-mail em português (recuperar senha, convite, senha alterada)
docs/RESTAURAR.md     Como restaurar tudo a partir de uma tag de backup
publicar/             Pacote do site para a Hostinger e o script que o gera
_redirects            Rotas para o Netlify
vercel.json           Rotas para a Vercel
```

## Segurança

- Visitantes só conseguem ler **um perfil pelo link exato** e **apenas se estiver no ar**. Não dá para listar perfis nem ver dados internos (função `perfil_publico`).
- **Clientes, perfis e fotos:** criar, editar e excluir exige login **e** estar na tabela `admins`. Visitantes e usuários comuns não veem nenhum dado de cliente.
- **Quem pode virar administrador:** a lista `admins_autorizados` só pode ser mudada pelo SQL Editor; nem um administrador consegue alterá-la pelo site. A promoção automática só vale para contas criadas pelo painel do Supabase (*Add user* ou *Invite user*) depois de o e-mail ser autorizado. Contas do cadastro público nunca viram administradoras.
- **Se o Supabase não carregar** (falha de internet ou bloqueador), o painel mostra um erro. Ele nunca cai no modo demonstração, que aceitaria qualquer senha.
- **Sessão:** o painel confere se a conta é administradora ao entrar e ao reabrir. Se não for, desconecta.
- **Link de nova senha:** vale uma vez, expira em 1 hora e é apagado da barra de endereço assim que a página abre.

## Próximas ideias

- **Estatísticas:** quantas vezes cada chaveiro foi lido.
- **Login do cliente**, para ele editar os próprios links (plano "Pro").
- **Desativação automática** de perfis com vencimento atrasado há X dias.
- **Cobrança automática:** link do Mercado Pago ou Asaas que reativa o perfil ao pagar.
- **Modelos prontos** por segmento: salão, restaurante, pet (coleira), emergência médica, corretor.
- **Vários links por cliente**, como os chaveiros da equipe de uma empresa.
