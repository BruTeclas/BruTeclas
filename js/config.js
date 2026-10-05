/*
 * CONFIGURAÇÃO DO SITE
 * ---------------------------------------------------------------------------
 * Preencha com os dados do seu projeto Supabase
 * (Supabase > Project Settings > API).
 *
 * Enquanto supabaseUrl estiver vazio, o site roda em MODO DEMONSTRAÇÃO:
 * tudo fica salvo só no seu navegador, para você testar o painel.
 *
 * A "anon key" é pública por natureza (vai para o navegador de qualquer
 * visitante). A segurança está nas regras do banco (supabase/schema.sql).
 * NUNCA coloque aqui a "service_role key".
 */
window.CONFIG = {
  supabaseUrl: "",       // ex.: "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",   // ex.: "eyJhbGciOi..."

  // Endereço público do site, usado nos links e QR Codes dos perfis.
  // Vazio = usa o endereço atual do navegador.
  dominio: "",           // ex.: "https://bruteclas.com.br"

  marca: "BruTeclas",

  // Crédito no rodapé de todos os perfis. O nome vira link para "url".
  // Use credito: null para não mostrar nada.
  credito: { texto: "Desenvolvido por", nome: "FrontIA", url: "https://frontia.com.br/" }
};
