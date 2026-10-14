-- Desfaz a v1.5.0: apaga a marca de teste dos perfis.
-- Os perfis que estavam em teste continuam com o vencimento que tinham.
alter table public.perfis drop column if exists teste_desde;
