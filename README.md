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

- **Site:** arquivos estáticos na Hostinger, em `nfcliente.com.br` (veja *Hospedagem*).
- **Banco e fotos:** o [Supabase](https://supabase.com) guarda clientes, perfis, imagens e o seu login. Hoje está no plano gratuito (veja *Plano do Supabase*).
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

Ao criar um perfil para um cliente, a página já nasce com os contatos do cadastro: WhatsApp, e-mail, redes e site. No editor, o botão **"Trazer contatos do cadastro"** completa o que faltar.

O **endereço não entra sozinho**. Num chaveiro perdido ou numa coleira de pet, quem acha teria a chave **e** o endereço da casa. Para colocar o botão "Como chegar", marque **"Incluir também o endereço"** ao criar o perfil. A caixa vem desmarcada e só aparece quando o cadastro tem rua e cidade e "Já colocar na página os contatos" está marcada. Depois, também dá para adicionar um link do Google Maps no editor.

### Acesso ao painel

- **Login** só para administradores, com mensagens claras para senha errada, e-mail não confirmado e excesso de tentativas.
- **"Esqueci minha senha"** envia um link por e-mail. A página `admin/redefinir-senha.html` cria a nova senha: mínimo de 8 caracteres, com letras e números.
- **"Minha conta"** troca a senha. A senha atual é conferida antes, e os outros aparelhos são desconectados.
- QR Code do perfil para imprimir no verso do chaveiro.

## Testar no computador

Precisa só do [Node.js](https://nodejs.org); não é preciso instalar mais nada.

```bash
node ferramentas/servidor-local.js --demo   # modo demonstração: nada vai para o banco
node ferramentas/servidor-local.js          # usa o Supabase de verdade (dados reais!)
```

Abra `http://localhost:3000/admin`. Um perfil abre em `http://localhost:3000/<link>`, como no site.

O servidor local aplica as mesmas regras e cabeçalhos de segurança do `.htaccess`: `/<link>`, `/admin`, CSP e bloqueio de arquivos internos. Assim, o que funciona nele funciona na Hostinger.

- **Modo demonstração (`--demo`):**
  - os dados ficam só no navegador;
  - qualquer e-mail e senha entram;
  - já vêm 3 perfis de exemplo.

  Nada é alterado em `js/config.js`.
- **Sem `--demo`:** o login e as alterações valem no banco de verdade, como no site.

## Supabase: o que já está pronto

O projeto **NFC Ambiente** já está configurado:

- **Banco:** tabelas `admins`, `admins_autorizados`, `clientes` e `perfis`, a função `perfil_publico` e o bucket `imagens`. O conteúdo está em [`supabase/schema.sql`](supabase/schema.sql).
- **Regras de acesso testadas no banco real:**
  - visitante só vê um perfil no ar, pelo link exato;
  - usuário logado que não é administrador não vê nada;
  - administrador vê e grava tudo.
- **E-mail autorizado como administrador:** `bru.teclas@gmail.com`. A conta com esse e-mail vira administradora sozinha quando é criada e confirmada.
- **`js/config.js`** já aponta para o projeto, com a chave **pública** (publishable).

## Supabase: configurações do painel

Essas opções não podem ser mudadas pelo banco. Elas foram feitas em outubro de 2026, em [supabase.com/dashboard](https://supabase.com/dashboard), no projeto **NFC Ambiente**. Confira de vez em quando e refaça tudo se criar um projeto novo:

1. **Authentication → URL Configuration**
   - **Site URL:** `https://nfcliente.com.br`.
   - **Redirect URLs:** adicione `https://nfcliente.com.br/admin/redefinir-senha.html` e `http://localhost:3000/admin/redefinir-senha.html`.
2. **Authentication → Sign In / Providers**
   - Em **User Signups**:
     - desligue **"Allow new users to sign up"**. Ninguém cria conta sozinho; só entra quem você cadastrar;
     - desligue **"Allow anonymous sign-ins"**;
     - mantenha **"Confirm email"** ligado.
   - Em **Email**:
     - ligue **"Secure password change"** e **"Secure email change"**;
     - em **"Minimum password length"**, coloque `8`;
     - em **"Password requirements"**, escolha letras e números.
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

### Plano do Supabase

O projeto está no **plano gratuito**:

- **Pausa por inatividade:** o projeto pausa depois de cerca de **7 dias sem uso**. Enquanto estiver pausado, **todos os chaveiros param de funcionar**. Para reativar, entre no painel do Supabase e clique em *Restore project*.
- **Cotas:** há limite de tráfego (5 GB por mês, contando as fotos baixadas pelos visitantes) e de espaço para fotos (1 GB). Acompanhe em **Settings → Usage**.
- **Para não depender disso:** o **plano Pro** não pausa, tem backup diário e permite um limite de gastos (*spend cap*).

## Hospedagem (Hostinger: nfcliente.com.br)

O site está publicado na Hostinger, no plano Premium (usuário `u253849728`), com SSL Let's Encrypt ativo e redirecionamento para HTTPS.

- **Regras de endereço:** o `.htaccess` faz `nfcliente.com.br/<link>` abrir o perfil e `/admin` abrir o painel. Ele também tira o `www` e bloqueia arquivos que não são do site.
- **Cabeçalhos de segurança:** o `.htaccess` também envia:
  - **HSTS:** o navegador passa a usar sempre HTTPS;
  - **CSP:** a lista de onde o site pode carregar scripts, estilos, fotos e conexões.
  
  Se um dia o site precisar de outro serviço externo (por exemplo, fotos de outro endereço ou um script de estatísticas), inclua esse endereço na linha `Content-Security-Policy`. Sem isso, o navegador bloqueia.
- **O que vai para o servidor:** só o que está em `publicar/nfcliente-site.zip`. README, SQL, modelos de e-mail, `docs/` e `ferramentas/` ficam de fora.

### Atualizar o site

1. Gere o pacote de novo e faça commit:
   ```bash
   python3 publicar/montar-pacote.py
   git add -A && git commit -m "Atualiza o site" && git push
   ```
2. Na Hostinger, publique o pacote. Pelo hPanel: **Sites → nfcliente.com.br → Gerenciador de arquivos**, envie `nfcliente-site.zip` para `public_html` e extraia.
   Outra opção é pedir ao Claude ("publique de novo na Hostinger"). Ele clona o repositório numa pasta temporária do servidor e publica o pacote. **O pacote substitui todo o conteúdo do site.** Para isso, Claude precisa de duas coisas:
   - o **conector da Hostinger** autorizado nas configurações de conectores do claude.ai;
   - acesso ao repositório. Se ele estiver privado, que é o recomendado, cadastre a **chave de implantação** (*deploy key*) da Hostinger no GitHub, em *Settings → Deploy keys*, só com leitura. A chave aparece no hPanel, em *Avançado → Git*.
3. Confira `https://nfcliente.com.br/admin` e um perfil. Para garantir a versão nova, use uma aba anônima.

> Netlify e Vercel também funcionam: `_redirects` e `vercel.json` têm as mesmas regras de endereço, mas **não** têm os cabeçalhos de segurança do `.htaccess` (CSP, HSTS), que precisariam ser copiados. GitHub Pages não serve, porque não consegue mandar `/<link>` para a página do perfil.

## Gravar o chaveiro
1. No painel: **Ativar novo perfil** → configure → **Liberar para o cliente**.
2. Copie o link do perfil.
3. No app **NFC Tools** (Android ou iPhone): *Escrever → Adicionar registro → URL* → cole o link → *Escrever* → encoste o chaveiro.
4. Teste com o celular. Depois, se quiser, trave a tag em *Outras → Bloquear tag*. É irreversível, mas como o link nunca muda isso não atrapalha.

> ⚠️ Use chaveiros **NFC NTAG213, 215 ou 216 (13,56 MHz)**. Chaveiros RFID de **125 kHz**, de portaria,
> **não** são lidos por celular.

## Backup

- **Código e documentação:** tudo fica no GitHub, no repositório `BruTeclas/BruTeclas`, com o histórico completo das versões. Mantenha-o **privado** (*Settings → General → Danger Zone → Change visibility*). O resumo do que mudou em cada data está em [`docs/HISTORICO.md`](docs/HISTORICO.md).
- **Ponto de restauração:** uma tag `backup-AAAA-MM-DD` marca uma versão que você sabe que funciona. Para criar uma pelo GitHub:
  1. Abra **Releases → Draft a new release**.
  2. Em **Choose a tag**, digite `backup-AAAA-MM-DD` e escolha *Create new tag*.
  3. Clique em **Publish release**. O GitHub gera o ZIP para download.
- **Restaurar:** siga [`docs/RESTAURAR.md`](docs/RESTAURAR.md).
- **Dados de clientes:** **não** ficam no GitHub, nem mesmo com o repositório privado; o guia explica como guardá-los à parte.

## Estrutura dos arquivos

```
index.html            Página inicial do domínio (sua vitrine; personalize)
perfil.html           Página pública de cada perfil (/<link>)
admin/                Painel com login
  index.html, admin.js, admin.css
  redefinir-senha.html, redefinir-senha.js  Página do link "Esqueci minha senha" e do convite
js/config.js          Endereço do Supabase, chave pública e domínio
js/db.js              Acesso ao banco (Supabase ou modo demonstração)
js/perfil-render.js   Desenha a página do perfil, gera o Pix e o vCard
js/pagina-perfil.js   Carrega o perfil pelo link e mostra os avisos (fora do ar, não encontrado)
js/lib/               Bibliotecas de terceiros com versão fixa (Supabase e QR Code) e suas licenças
css/perfil.css        Visual da página do perfil
supabase/schema.sql   Tabelas, regras de segurança e armazenamento de fotos
supabase/templates/   Modelos de e-mail em português (recuperar senha, convite, senha alterada)
docs/RESTAURAR.md     Como restaurar tudo a partir de uma tag de backup
docs/HISTORICO.md     O que mudou em cada versão
ferramentas/servidor-local.js  Testar o site no computador com as regras da Hostinger
publicar/             Pacote do site para a Hostinger e o script que o gera
_redirects            Rotas para o Netlify
vercel.json           Rotas para a Vercel
```

## Segurança

- **Contas:** mantenha a verificação em duas etapas ligada no Gmail, no GitHub, na Hostinger e no Supabase. Quem entra em uma dessas contas controla o sistema.
- Visitantes só conseguem ler **um perfil pelo link exato** e **apenas se estiver no ar**. Não dá para listar perfis nem ver dados internos (função `perfil_publico`).
- **Clientes, perfis e fotos:** criar, editar e excluir exige login **e** estar na tabela `admins`. Visitantes e usuários comuns não veem nenhum dado de cliente.
- **Quem pode virar administrador:** a lista `admins_autorizados` só pode ser mudada pelo SQL Editor; nem um administrador consegue alterá-la pelo site. A promoção automática só vale para contas criadas pelo painel do Supabase (*Add user* ou *Invite user*) depois de o e-mail ser autorizado. Contas do cadastro público nunca viram administradoras.
- **Se o Supabase não carregar** (falha de internet ou bloqueador), o painel mostra um erro. Ele nunca cai no modo demonstração, que aceitaria qualquer senha.
- **Sessão:** o painel confere se a conta é administradora ao entrar e ao reabrir. Se não for, desconecta.
- **Link de nova senha:** vale uma vez, expira em 1 hora e é apagado da barra de endereço assim que a página abre.
- **Bibliotecas de terceiros:** o Supabase e o gerador de QR Code ficam dentro do site, em `js/lib/`, com a versão no nome do arquivo. Uma versão nova publicada por terceiros nunca entra sozinha. Para atualizar, baixe a nova versão (`npm pack @supabase/supabase-js@X.Y.Z`), troque o arquivo, ajuste o nome nas páginas e em `publicar/montar-pacote.py` e teste. A pasta não pode se chamar `vendor`: a publicação da Hostinger descarta pastas com esse nome.
- **Nenhum script embutido nas páginas:** todo o JavaScript fica em arquivos `.js`. Assim a CSP pode proibir scripts embutidos, que é o caminho mais comum de um ataque de injeção (XSS).
- **Página pública sem sessão:** as páginas dos perfis consultam o banco como visitante, sem usar, renovar ou gravar o login do painel.
  Isso **não isola** a sessão: o painel e os perfis estão no mesmo endereço (`nfcliente.com.br`) e dividem o armazenamento do navegador. Quem protege a sessão é a CSP, que impede scripts injetados. Para isolar de verdade, o passo seguinte é mover o painel para um subdomínio próprio (por exemplo `admin.nfcliente.com.br`).
- **Endereço do cliente:** só vai para a página se você marcar a caixa (veja *Clientes*).

## Próximas ideias

- **Estatísticas:** quantas vezes cada chaveiro foi lido.
- **Login do cliente**, para ele editar os próprios links (plano "Pro").
- **Desativação automática** de perfis com vencimento atrasado há X dias.
- **Cobrança automática:** link do Mercado Pago ou Asaas que reativa o perfil ao pagar.
- **Modelos prontos** por segmento: salão, restaurante, pet (coleira), emergência médica, corretor.
- **Vários links por cliente**, como os chaveiros da equipe de uma empresa.
