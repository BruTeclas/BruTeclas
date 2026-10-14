-- =============================================================================
-- NFCliente v1.5.0 · Teste grátis
-- Rode uma vez no SQL Editor do Supabase. Para desfazer: v1.5.0-desfazer.sql
--
-- O teste usa o vencimento automático que já existe (vencimento = dia do início, e a página
-- fica no ar mais 3 dias). Este campo só marca que o perfil está em teste, para o painel separar
-- "Em teste" e "Teste não fechou" dos clientes pagantes. A página pública não muda.
-- =============================================================================
alter table public.perfis add column if not exists teste_desde date;
comment on column public.perfis.teste_desde is 'Dia em que o teste grátis começou (v1.5.0). Vazio: não é teste, ou o cliente foi efetivado.';
