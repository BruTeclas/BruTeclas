# Histórico de versões

O que mudou no sistema, da versão mais nova para a mais antiga. O detalhe técnico de cada mudança está no histórico de commits do GitHub.

## Como as versões são numeradas

- **Melhoria nova** (por exemplo, vencimento automático): sobe o número do meio. `v1.0.0` → `v1.1.0` → `v1.2.0`.
- **Correção pequena** numa versão: sobe o último número. `v1.1.0` → `v1.1.1`.
- **Mudança grande**, que muda o jeito de usar o sistema: sobe o primeiro número. `v1.x` → `v2.0.0`.

Cada versão publicada ganha um **ponto de restauração** no GitHub, um branch chamado `versao-X.Y.Z`. Ele fica congelado com o código, a documentação, o pacote do site (`publicar/nfcliente-site.zip`) e a estrutura do banco (`supabase/schema.sql`) daquela versão. Para voltar a uma versão, siga [`RESTAURAR.md`](RESTAURAR.md).

Quando uma versão mexer no banco, ela também traz um script para desfazer a mudança. Os scripts ficam em `supabase/versoes/`.

## v1.0.0 · 13/10/2026: versão estável (ponto de restauração `versao-1.0.0`)

É a versão que está no ar desde 06/10/2026 e funciona sem problemas. Em relação à v0.2.0, o site não mudou: só a documentação e as ferramentas.

- **Banco:** conferido em 13/10/2026; a estrutura real é idêntica a `supabase/schema.sql`.
- Projeto renomeado para **NFCliente** no GitHub (`BruTeclas/NFCliente`).
- README revisado:
  - hospedagem na Hostinger;
  - configurações do Supabase já feitas;
  - plano gratuito do Supabase: pausa e cotas;
  - backup por tags e releases;
  - verificação em duas etapas nas contas.
- **Servidor local** (`ferramentas/servidor-local.js`): testa o site no computador com as mesmas regras e cabeçalhos de segurança da Hostinger, com ou sem modo demonstração.
- Este histórico e um `.gitignore`, que impede enviar arquivos de senha (`.env`) e pastas temporárias ao GitHub.

## v0.2.0 · 06/10/2026: ajustes de segurança

Feitos a partir da análise de segurança. O relatório é confidencial e não fica no GitHub.

- **Bibliotecas:**
  - o Supabase e o gerador de QR Code passaram a ficar dentro do site (`js/lib/`), com versão fixa;
  - uma versão nova ou adulterada publicada por terceiros não entra mais sozinha no ar.
- **Cabeçalhos de segurança:**
  - **CSP:** o navegador só roda scripts do próprio site;
  - **HSTS:** sempre HTTPS.
  - Para isso, os scripts que ficavam embutidos nas páginas foram para arquivos `.js`.
- **Páginas públicas:** consultam o banco como visitante, sem usar o login do painel.
- **Endereço do cliente:**
  - não vai mais sozinho para a página do perfil;
  - ao criar o perfil, há a caixa "Incluir também o endereço", que vem desmarcada.
- **Banco:**
  - a promoção automática a administrador ficou mais rígida;
  - só vale para contas criadas ou convidadas pelo painel do Supabase.
- **Contas e Supabase (ajustes feitos por você):**
  - verificação em duas etapas;
  - cadastro público desligado;
  - "Secure password change" ligado.
- **Publicação:**
  - a pasta das bibliotecas se chama `js/lib`, porque a publicação da Hostinger descarta pastas chamadas `vendor`;
  - essa falha deixou o site cerca de 10 minutos sem a biblioteca do Supabase em 06/10/2026, já corrigida.
- **Repositório no GitHub:** recomendado mantê-lo privado, publicando com a chave de implantação da Hostinger.
- Guia de restauração ([`RESTAURAR.md`](RESTAURAR.md)).

## v0.1.0 · 05/10/2026: primeira versão no ar

- **Página do perfil** para chaveiro NFC:
  - links de WhatsApp, Pix (QR Code e Copia e Cola), Google, contato e 16 redes sociais;
  - botões "Salvar contato" e "Compartilhar".
- **Painel com login:**
  - "Ativar novo perfil", configurar, liberar, desativar (pagamento atrasado) e excluir;
  - modo demonstração com perfis de exemplo.
- **Visual:**
  - os 2 primeiros links aparecem em destaque abaixo da descrição;
  - sem foto de fundo, o fundo usa a cor principal do perfil;
  - rodapé "Desenvolvido por FrontIA" com link para frontia.com.br.
- **Supabase:**
  - cadastro de clientes (CPF/CNPJ, contatos, endereço, redes, plano e valor);
  - login de administrador, "Esqueci minha senha", troca de senha;
  - e-mails em português.
- **Publicação na Hostinger** em `nfcliente.com.br`, com HTTPS.
- **Links que faltava preencher:**
  - o editor mostra o que falta em cada link;
  - a prévia mostra o botão tracejado.
- **WhatsApp:** passou a funcionar com número sem o 55.
