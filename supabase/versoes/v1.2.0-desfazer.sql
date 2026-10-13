-- =============================================================================
-- Desfaz a v1.2.0: a função volta a dizer a situação do perfil (versão da v1.1.0).
-- Rode no SQL Editor do Supabase.
-- =============================================================================

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
