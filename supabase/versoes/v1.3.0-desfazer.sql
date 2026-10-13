-- Desfaz a v1.3.0: apaga links do cliente, sessões e histórico. Rode no SQL Editor do Supabase.
drop trigger if exists perfis_historico on public.perfis;
drop function if exists public.cliente_autorizar_envio(text), public.cliente_salvar(text, jsonb), public.dados_do_cliente(jsonb, uuid),
  public.cliente_perfil_da_sessao(text), public.cliente_entrar(text, text), public.revogar_link_cliente(uuid),
  public.gerar_link_cliente(uuid), public.guardar_historico();
drop table if exists public.sessoes_cliente, public.links_cliente, public.perfis_historico;
