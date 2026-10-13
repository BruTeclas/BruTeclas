-- =============================================================================
-- NFCliente v1.2.0 · Página pública: a mesma resposta para tudo que não está no ar
-- Rode no SQL Editor do Supabase. Para desfazer: v1.2.0-desfazer.sql
--
-- Antes: a função dizia a situação do perfil ("inativo", "rascunho"), o que deixava
-- descobrir que um link existe. Agora só devolve conteúdo de perfil no ar e dentro
-- do vencimento; em qualquer outro caso (inexistente, desativado, vencido, em
-- configuração) devolve nada, e a página mostra "Perfil indisponível".
-- =============================================================================

create or replace function public.perfil_publico(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('status', 'ativo', 'dados', dados)
  from public.perfis
  where slug = lower(p_slug)
    and status = 'ativo'
    and not public.perfil_vencido(vencimento);
$$;
revoke all on function public.perfil_publico(text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;
