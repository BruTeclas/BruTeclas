-- =============================================================================
-- Banco de dados (Supabase): administradores, clientes, perfis e imagens.
-- Pode rodar de novo sem problema (é idempotente).
-- No projeto "NFC Ambiente" ele já foi aplicado como migração.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Administradores
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "admin ve a si mesmo" on public.admins;
create policy "admin ve a si mesmo" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- E-mails que viram administradores automaticamente quando a conta é criada
-- e o e-mail está confirmado. Sem políticas: só o SQL Editor mexe aqui.
create table if not exists public.admins_autorizados (
  email     text primary key check (email = lower(email)),
  criado_em timestamptz not null default now()
);
alter table public.admins_autorizados enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.promover_admin_autorizado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admins_autorizados where email = lower(new.email)) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.promover_admin_autorizado() from public, anon, authenticated;

drop trigger if exists promover_admin_autorizado on auth.users;
create trigger promover_admin_autorizado
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.promover_admin_autorizado();

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientes (dados internos: só administradores leem e escrevem)
-- -----------------------------------------------------------------------------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(btrim(nome)) between 1 and 120),
  tipo_pessoa   text not null default 'fisica' check (tipo_pessoa in ('fisica', 'juridica')),
  documento     text check (documento ~ '^([0-9]{11}|[0-9]{14})$'),          -- CPF ou CNPJ, só dígitos
  nascimento    date,
  email         text check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefone      text check (telefone ~ '^[0-9]{10,13}$'),                    -- só dígitos, com DDD
  whatsapp      text check (whatsapp ~ '^[0-9]{10,13}$'),
  cep           text check (cep ~ '^[0-9]{8}$'),
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text,
  uf            text check (uf ~ '^[A-Z]{2}$'),
  redes         jsonb not null default '{}'::jsonb check (jsonb_typeof(redes) = 'object'),
  plano         text,
  valor_mensal  numeric(10, 2) check (valor_mensal >= 0),
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists clientes_documento_unico on public.clientes (documento) where documento is not null;
create index if not exists clientes_nome_idx on public.clientes (lower(nome));
alter table public.clientes enable row level security;

drop policy if exists "admin gerencia clientes" on public.clientes;
create policy "admin gerencia clientes" on public.clientes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tocar_updated_at();

-- -----------------------------------------------------------------------------
-- Perfis (a página pública de cada chaveiro)
-- -----------------------------------------------------------------------------
create table if not exists public.perfis (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  status      text not null default 'rascunho'
              check (status in ('rascunho', 'ativo', 'inativo')),
  dados       jsonb not null default '{}'::jsonb,                 -- o que aparece na página
  cliente_id  uuid references public.clientes (id) on delete set null,
  vencimento  date,                                             -- uso interno
  observacoes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.perfis add column if not exists cliente_id uuid references public.clientes (id) on delete set null;
create index if not exists perfis_cliente_idx on public.perfis (cliente_id);
alter table public.perfis enable row level security;

drop policy if exists "admin gerencia perfis" on public.perfis;
create policy "admin gerencia perfis" on public.perfis
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop trigger if exists perfis_updated_at on public.perfis;
create trigger perfis_updated_at before update on public.perfis
  for each row execute function public.tocar_updated_at();

-- Leitura pública: só pelo link exato, e só devolve o conteúdo se estiver no ar.
-- Visitantes não conseguem listar perfis nem ver dados internos ou de clientes.
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

-- -----------------------------------------------------------------------------
-- Permissões das tabelas (as regras acima decidem quais linhas cada um vê)
-- -----------------------------------------------------------------------------
revoke all on public.admins, public.admins_autorizados, public.clientes, public.perfis from anon;
revoke all on public.admins_autorizados from authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.clientes, public.perfis to authenticated;

-- -----------------------------------------------------------------------------
-- Imagens (foto de perfil e de fundo): leitura pública pelo endereço da imagem,
-- envio e exclusão só por administradores.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin le imagens" on storage.objects;
create policy "admin le imagens" on storage.objects
  for select to authenticated using (bucket_id = 'imagens' and (select public.is_admin()));

drop policy if exists "admin envia imagens" on storage.objects;
create policy "admin envia imagens" on storage.objects
  for insert to authenticated with check (bucket_id = 'imagens' and (select public.is_admin()));

drop policy if exists "admin altera imagens" on storage.objects;
create policy "admin altera imagens" on storage.objects
  for update to authenticated using (bucket_id = 'imagens' and (select public.is_admin()));

drop policy if exists "admin apaga imagens" on storage.objects;
create policy "admin apaga imagens" on storage.objects
  for delete to authenticated using (bucket_id = 'imagens' and (select public.is_admin()));

-- =============================================================================
-- Quem é administrador: inclua o e-mail aqui ANTES de criar a conta
-- (Authentication > Users > Add user). A conta vira administradora sozinha
-- quando o e-mail estiver confirmado. Para uma conta que já existe, rode também
-- a segunda linha.
--
-- insert into public.admins_autorizados (email) values ('email@exemplo.com') on conflict do nothing;
-- insert into public.admins (user_id) select id from auth.users where lower(email) = 'email@exemplo.com' and email_confirmed_at is not null on conflict do nothing;
-- =============================================================================
