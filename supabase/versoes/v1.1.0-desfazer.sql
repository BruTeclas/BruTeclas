-- =============================================================================
-- Desfaz a v1.1.0: perfis voltam a ignorar o vencimento (só a situação manual vale).
-- Rode no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.perfil_publico(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case
           when status = 'ativo' then jsonb_build_object('status', status, 'dados', dados)
           else jsonb_build_object('status', status)
         end
  from public.perfis
  where slug = lower(p_slug);
$$;
revoke all on function public.perfil_publico(text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;

drop function if exists public.perfil_vencido(date);
