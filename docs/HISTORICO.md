# Histórico de versões

O que mudou no sistema, da versão mais nova para a mais antiga. O detalhe técnico de cada mudança está no histórico de commits do GitHub.

## 13/10/2026: documentação

- Projeto renomeado para **NFCliente** no GitHub (`BruTeclas/NFCliente`).
- README revisado:
  - hospedagem na Hostinger;
  - configurações do Supabase já feitas;
  - plano gratuito do Supabase: pausa e cotas;
  - backup por tags e releases;
  - verificação em duas etapas nas contas.
- **Servidor local** (`ferramentas/servidor-local.js`): testa o site no computador com as mesmas regras e cabeçalhos de segurança da Hostinger, com ou sem modo demonstração.
- Este histórico e um `.gitignore`, que impede enviar arquivos de senha (`.env`) e pastas temporárias ao GitHub.

## 06/10/2026: ajustes de segurança

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

## 05/10/2026: primeira versão no ar

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
