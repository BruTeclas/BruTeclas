# Página de links do cliente (chaveiro RFID/NFC)

Modelo de página "link na bio" para abrir quando o cliente aproxima o chaveiro do celular.
Um único `index.html`, sem servidor nem banco de dados: dá para hospedar grátis no
GitHub Pages, Netlify ou Vercel.

## O que já vem pronto

| Botão | Como funciona |
|---|---|
| **Redes sociais** (Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Threads, Kwai, Pinterest, Telegram, Spotify, Twitch, Discord, Snapchat, Behance, GitHub) | Basta o `usuario` ou a URL completa. Campo vazio = ícone não aparece. |
| **WhatsApp** | Abre `wa.me` já com uma mensagem pronta (ex.: "Vim pelo seu chaveiro..."). |
| **Pix** | Abre uma janela com **QR Code**, botão **Pix Copia e Cola** (gerado no padrão do Banco Central, com valor opcional) e botão para copiar só a chave. |
| **Google** | "Avalie no Google" (link de avaliação do Perfil da Empresa), "Como chegar" (Maps) e Perfil da Empresa. |
| **E-mail / Ligar / Site** | `mailto:`, `tel:` e link normal. |
| **Botões extras** | Quantos quiser: cardápio, catálogo, agenda, portfólio, loja... com qualquer ícone do [Font Awesome](https://fontawesome.com/search?o=r&m=free). |
| **Salvar contato** | Baixa um `.vcf` com nome, telefone, e-mail e site, direto na agenda do celular. |
| **Compartilhar** | Usa o compartilhamento nativo do celular (ou copia o link). |

Cor principal e tema (`escuro`/`claro`) configuráveis por cliente.

## Como usar

### Opção 1: uma página por cliente
Copie a pasta, edite o bloco `window.CLIENTE` no topo do `index.html` e publique.

### Opção 2: vários clientes no mesmo site (recomendado)
1. Crie `clientes/<apelido>.json` (copie `clientes/exemplo.json`).
2. Grave no chaveiro: `https://seusite.com/?c=<apelido>`
   Exemplo: `https://seusite.com/?c=exemplo`

Assim você muda os links do cliente a qualquer momento **sem regravar o chaveiro**.

Para testar no computador: `python3 -m http.server` na pasta e abra `http://localhost:8000/?c=exemplo`.

### Link de avaliação do Google
No Perfil da Empresa no Google → **Pedir avaliações** → copie o link (`https://g.page/r/.../review`).

## ⚠️ Importante sobre o chaveiro
Celulares leem **NFC (13,56 MHz)**. Chaveiros RFID de **125 kHz** (os de portaria/catraca)
**não** são lidos pelo celular. Use tags **NTAG213/215/216**.

Para gravar: app **NFC Tools** (Android/iPhone) → Escrever → Adicionar registro → **URL** → gravar.
Depois de testar, dá para **travar** a tag (Outras → Bloquear) para ninguém sobrescrever.
iPhone lê NFC automaticamente (XS ou mais novo); Android precisa estar com NFC ligado.

Dica: imprima também um **QR Code** com a mesma URL no verso do chaveiro, para quem tem NFC desligado.

## Ideias para evoluir

- **Domínio curto próprio** (ex.: `bruteclas.com/c/joao`) com redirecionamento — fica profissional e independente da hospedagem.
- **Painel de edição** para o cliente alterar os próprios links (Firebase/Supabase + login).
- **Contador de leituras** do chaveiro (Google Analytics, Plausible ou um contador simples por cliente).
- **Modo "cartão de visita"** vs **modo "pet"** (chaveiro de coleira: nome do pet, tutor, "me encontrou? chame no WhatsApp") vs **modo "emergência"** (tipo sanguíneo, alergias, contato).
- **Cardápio / catálogo** com fotos e preços na própria página.
- **Botão de agendamento** integrado (Calendly, Google Agenda, Trinks).
- **Cupom de desconto** que aparece só para quem leu o chaveiro.
- **Galeria de fotos** / vídeo de apresentação no topo.
- **Wi‑Fi do estabelecimento** com botão para copiar a senha.
- **Planos de venda**: Básico (página + chaveiro), Pro (domínio + estatísticas), Empresa (vários chaveiros para a equipe).
