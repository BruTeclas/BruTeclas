-- =============================================================================
-- Banco de dados dos perfis (Supabase)
-- Cole tudo no Supabase > SQL Editor > New query > Run.
-- Pode rodar de novo sem problema (é idempotente).
-- =============================================================================

-- Quem pode entrar no painel ---------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

drop policy if exists "admin ve a si mesmo" on public.admins;
create policy "admin ve a si mesmo" on public.admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Perfis -----------------------------------------------------------------------
create table if not exists public.perfis (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  status          text not null default 'rascunho'
                  check (status in ('rascunho', 'ativo', 'inativo')),
  dados           jsonb not null default '{}'::jsonb,   -- o que aparece na página
  cliente_nome    text,                                 -- uso interno (não aparece)
  cliente_contato text,
  vencimento      date,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.perfis enable row level security;

drop policy if exists "admin gerencia perfis" on public.perfis;
create policy "admin gerencia perfis" on public.perfis
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists perfis_updated_at on public.perfis;
create trigger perfis_updated_at before update on public.perfis
  for each row execute function public.tocar_updated_at();

-- Leitura pública: só pelo link exato, e só devolve o conteúdo se estiver ativo.
-- Visitantes não conseguem listar perfis nem ver dados internos.
create or replace function public.perfil_publico(p_slug text)
returns jsonb
language sql stable security definer
set search_path = public
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

-- Imagens (foto de perfil e de fundo) ------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "admin le imagens" on storage.objects;
create policy "admin le imagens" on storage.objects
  for select to authenticated using (bucket_id = 'imagens' and public.is_admin());

drop policy if exists "admin envia imagens" on storage.objects;
create policy "admin envia imagens" on storage.objects
  for insert to authenticated with check (bucket_id = 'imagens' and public.is_admin());

drop policy if exists "admin altera imagens" on storage.objects;
create policy "admin altera imagens" on storage.objects
  for update to authenticated using (bucket_id = 'imagens' and public.is_admin());

drop policy if exists "admin apaga imagens" on storage.objects;
create policy "admin apaga imagens" on storage.objects
  for delete to authenticated using (bucket_id = 'imagens' and public.is_admin());

-- =============================================================================
-- DEPOIS de criar seu usuário em Authentication > Users > Add user,
-- troque o e-mail abaixo e rode só esta linha para virar administrador:
--
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'SEU_EMAIL_AQUI'
--   on conflict do nothing;
-- =============================================================================
