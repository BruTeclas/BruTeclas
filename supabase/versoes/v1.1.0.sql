-- =============================================================================
-- NFCliente v1.1.0 · Perfil sai do ar sozinho quando a cobrança vence
-- Rode no SQL Editor do Supabase. Para desfazer: v1.1.0-desfazer.sql
--
-- Regra: com vencimento preenchido, a página continua no ar até 3 dias depois
-- do vencimento (carência) e sai do ar no 4º dia, no horário de Brasília.
-- Ao renovar (nova data), volta na hora. Sem vencimento, nunca sai do ar.
-- Nada é gravado nem apagado: a situação é calculada a cada acesso.
-- =============================================================================

-- Vencido = passou do vencimento + carência. Mantenha a carência igual a CARENCIA_DIAS em js/db.js.
create or replace function public.perfil_vencido(p_vencimento date)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_vencimento is not null
     and (now() at time zone 'America/Sao_Paulo')::date > p_vencimento + 3;
$$;
revoke all on function public.perfil_vencido(date) from public;
grant execute on function public.perfil_vencido(date) to anon, authenticated;

-- Leitura pública: perfil vencido responde como desativado ("temporariamente indisponível").
create or replace function public.perfil_publico(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case
           when status = 'ativo' and public.perfil_vencido(vencimento) then jsonb_build_object('status', 'inativo')
           when status = 'ativo' then jsonb_build_object('status', status, 'dados', dados)
           else jsonb_build_object('status', status)
         end
  from public.perfis
  where slug = lower(p_slug);
$$;
revoke all on function public.perfil_publico(text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;
