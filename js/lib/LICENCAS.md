# Bibliotecas de terceiros (cópias locais, com versão fixa)

Ficam dentro do site, em vez de vir de uma CDN, para que uma versão nova ou adulterada nunca entre no ar sem revisão.
Para atualizar: baixe a versão nova com `npm pack <pacote>@<versão>`, confira as mudanças, troque o arquivo, ajuste as tags `<script>` e o `publicar/montar-pacote.py`.

| Arquivo | Pacote | Versão | Licença |
|---|---|---|---|
| `supabase-js-2.117.2.js` | [@supabase/supabase-js](https://github.com/supabase/supabase-js) (`dist/umd/supabase.js`) | 2.117.2 | MIT |
| `qrcode-1.0.0.min.js` | [qrcodejs](https://github.com/davidshimjs/qrcodejs) (`qrcode.min.js`) | 1.0.0 | MIT (Copyright (c) 2012 davidshimjs) |
