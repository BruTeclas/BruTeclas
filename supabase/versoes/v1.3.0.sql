-- =============================================================================
-- NFCliente v1.3.0 · Link de configuração para o próprio cliente
-- Rode uma vez no SQL Editor do Supabase. Para desfazer: v1.3.0-desfazer.sql
--
-- O administrador gera um link (cliente.nfcliente.com.br/#<código>) para um perfil no ar
-- com cliente. O cliente digita o PIN (4 últimos dígitos do WhatsApp ou do telefone do
-- cadastro) toda vez que abre o link. O banco guarda só o código embaralhado (sha256),
-- confere tudo o que o cliente envia e guarda a versão anterior a cada alteração.
-- =============================================================================

-- Link de cada perfil (um por perfil; gerar de novo substitui o anterior)
create table if not exists public.links_cliente (
  perfil_id     uuid primary key references public.perfis(id) on delete cascade,
  token_hash    text not null unique,
  criado_em     timestamptz not null default now(),
  revogado_em   timestamptz,
  ultimo_acesso timestamptz,
  erros_pin     int not null default 0,
  bloqueado_ate timestamptz
);
alter table public.links_cliente enable row level security;
create policy "admin ve links do cliente" on public.links_cliente for select to authenticated using ((select public.is_admin()));
revoke all on public.links_cliente from anon, authenticated;
grant select on public.links_cliente to authenticated;

-- Acesso do cliente depois do PIN (vale 2 horas; só as funções abaixo leem esta tabela)
create table if not exists public.sessoes_cliente (
  token_hash text primary key,
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  link_hash  text not null,
  expira_em  timestamptz not null,
  envios     int not null default 0
);
alter table public.sessoes_cliente enable row level security;
revoke all on public.sessoes_cliente from anon, authenticated;

-- Versão anterior da página a cada alteração (cliente ou administrador)
create table if not exists public.perfis_historico (
  id        bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  dados     jsonb not null,
  autor     text not null check (autor in ('cliente', 'admin')),
  criado_em timestamptz not null default now()
);
create index if not exists perfis_historico_perfil on public.perfis_historico (perfil_id, criado_em desc);
alter table public.perfis_historico enable row level security;
create policy "admin ve historico" on public.perfis_historico for select to authenticated using ((select public.is_admin()));
revoke all on public.perfis_historico from anon, authenticated;
grant select on public.perfis_historico to authenticated;

create or replace function public.guardar_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dados is distinct from old.dados then
    insert into public.perfis_historico (perfil_id, dados, autor)
    values (old.id, old.dados, coalesce(nullif(current_setting('nfc.autor', true), ''), 'admin'));
  end if;
  return new;
end; $$;
create trigger perfis_historico after update of dados on public.perfis
  for each row execute function public.guardar_historico();

-- ---------------------------------------------------------------------------
-- Administrador: gerar e revogar o link
-- ---------------------------------------------------------------------------
create or replace function public.gerar_link_cliente(p_perfil_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare p public.perfis; c public.clientes; codigo text;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into p from public.perfis where id = p_perfil_id;
  if not found then raise exception 'Perfil não encontrado.'; end if;
  if p.status <> 'ativo' or public.perfil_vencido(p.vencimento) then raise exception 'O perfil precisa estar no ar para gerar o link.'; end if;
  select * into c from public.clientes where id = p.cliente_id;
  if not found then raise exception 'Ligue um cliente a este perfil antes de gerar o link.'; end if;
  if length(regexp_replace(coalesce(c.whatsapp, '') || coalesce(c.telefone, ''), '\D', '', 'g')) < 4 then
    raise exception 'O cadastro do cliente precisa de WhatsApp ou telefone (o PIN são os 4 últimos dígitos).';
  end if;
  codigo := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.links_cliente (perfil_id, token_hash) values (p.id, encode(extensions.digest(codigo, 'sha256'), 'hex'))
  on conflict (perfil_id) do update set token_hash = excluded.token_hash, criado_em = now(), revogado_em = null,
    ultimo_acesso = null, erros_pin = 0, bloqueado_ate = null;
  return codigo;
end; $$;

create or replace function public.revogar_link_cliente(p_perfil_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.links_cliente set revogado_em = now() where perfil_id = p_perfil_id and revogado_em is null;
end; $$;

-- ---------------------------------------------------------------------------
-- Cliente: entrar com o PIN, salvar e enviar fotos
-- ---------------------------------------------------------------------------
create or replace function public.cliente_entrar(p_codigo text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.links_cliente; p public.perfis; c public.clientes; h text; sessao text; pin text;
begin
  if p_codigo is null or p_codigo !~ '^[A-Za-z0-9_-]{20,100}$' then return jsonb_build_object('erro', 'link_invalido'); end if;
  h := encode(extensions.digest(p_codigo, 'sha256'), 'hex');
  select * into l from public.links_cliente where token_hash = h for update;
  if not found or l.revogado_em is not null then return jsonb_build_object('erro', 'link_invalido'); end if;
  if l.bloqueado_ate > now() then
    return jsonb_build_object('erro', 'bloqueado', 'minutos', ceil(extract(epoch from l.bloqueado_ate - now()) / 60));
  end if;
  select * into p from public.perfis where id = l.perfil_id;
  select * into c from public.clientes where id = p.cliente_id;
  if p.status <> 'ativo' or public.perfil_vencido(p.vencimento) or c.id is null then return jsonb_build_object('erro', 'indisponivel'); end if;
  pin := coalesce(p_pin, '');
  if pin !~ '^\d{4}$' or pin not in (right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 4),
                                     right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 4)) then
    -- 5 erros seguidos: bloqueia o link por 30 minutos
    update public.links_cliente set
      erros_pin = case when l.erros_pin + 1 >= 5 then 0 else l.erros_pin + 1 end,
      bloqueado_ate = case when l.erros_pin + 1 >= 5 then now() + interval '30 minutes' else null end
    where perfil_id = l.perfil_id;
    if l.erros_pin + 1 >= 5 then return jsonb_build_object('erro', 'bloqueado', 'minutos', 30); end if;
    return jsonb_build_object('erro', 'pin_errado', 'restantes', 4 - l.erros_pin);
  end if;
  sessao := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.sessoes_cliente (token_hash, perfil_id, link_hash, expira_em)
  values (encode(extensions.digest(sessao, 'sha256'), 'hex'), p.id, h, now() + interval '2 hours');
  update public.links_cliente set erros_pin = 0, bloqueado_ate = null, ultimo_acesso = now() where perfil_id = p.id;
  return jsonb_build_object('sessao', sessao, 'slug', p.slug, 'dados', p.dados);
end; $$;

-- Perfil da sessão, se ela ainda vale (link não revogado nem trocado, perfil no ar); senão, null
create or replace function public.cliente_perfil_da_sessao(p_sessao text)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.perfil_id
  from public.sessoes_cliente s
  join public.links_cliente l on l.perfil_id = s.perfil_id and l.token_hash = s.link_hash and l.revogado_em is null
  join public.perfis p on p.id = s.perfil_id and p.status = 'ativo' and not public.perfil_vencido(p.vencimento)
  where p_sessao ~ '^[A-Za-z0-9_-]{20,100}$'
    and s.token_hash = encode(extensions.digest(p_sessao, 'sha256'), 'hex')
    and s.expira_em > now();
$$;

-- Confere e limpa o que o cliente enviou. Só estes campos podem mudar; links só dos tipos conhecidos,
-- textos com tamanho limitado, endereços só http(s), fotos só da pasta do próprio perfil.
create or replace function public.dados_do_cliente(p jsonb, p_perfil_id uuid)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb := '{}'; links jsonb := '[]'; l jsonb; novo jsonb; k text; v jsonb; i int := 0;
  tipos text[] := array['whatsapp','pix','google_avaliar','maps','google_perfil','email','telefone','site','link','instagram','facebook',
    'tiktok','youtube','linkedin','x','threads','kwai','pinterest','telegram','spotify','twitch','discord','snapchat','behance','github'];
  campos text[] := array['id','tipo','numero','mensagem','chave','nome','cidade','valor','url','email','titulo','subtitulo','icone','usuario','rotulo'];
  pasta text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/imagens/' || p_perfil_id::text || '/[A-Za-z0-9._-]+$';
begin
  if jsonb_typeof(p) <> 'object' then raise exception 'Dados inválidos.'; end if;
  r := jsonb_build_object(
    'nome', left(coalesce(p->>'nome', ''), 80),
    'descricao', left(coalesce(p->>'descricao', ''), 300),
    'cor', case when coalesce(p->>'cor', '') ~ '^#[0-9A-Fa-f]{6}$' then p->>'cor' else '#7c3aed' end,
    'tema', case when p->>'tema' = 'claro' then 'claro' else 'escuro' end,
    'mostrarSalvarContato', (p->'mostrarSalvarContato') is distinct from 'false'::jsonb,
    'mostrarCompartilhar', (p->'mostrarCompartilhar') is distinct from 'false'::jsonb);
  foreach k in array array['foto', 'capa'] loop
    if coalesce(p->>k, '') = '' then r := r || jsonb_build_object(k, '');
    elsif (p->>k) ~ pasta then r := r || jsonb_build_object(k, p->>k);
    else raise exception 'Foto inválida. Envie a imagem pela própria página.';
    end if;
  end loop;
  if jsonb_typeof(p->'links') = 'array' then
    if jsonb_array_length(p->'links') > 40 then raise exception 'São permitidos até 40 links.'; end if;
    for l in select * from jsonb_array_elements(p->'links') loop
      i := i + 1;
      if jsonb_typeof(l) <> 'object' or not ((l->>'tipo') = any (tipos)) then raise exception 'Link % inválido.', i; end if;
      novo := '{}';
      for k, v in select * from jsonb_each(l) loop
        continue when not (k = any (campos)) or jsonb_typeof(v) not in ('string', 'number');
        if length(v #>> '{}') > 500 then raise exception 'Texto muito longo no link %.', i; end if;
        if k = 'url' and (v #>> '{}') <> '' and (v #>> '{}') !~* '^(https?://)?[^\s<>"''`]+$' then raise exception 'Endereço inválido no link %.', i; end if;
        if k = 'url' and (v #>> '{}') ~* '^[a-z][a-z0-9+.-]*:' and (v #>> '{}') !~* '^https?://' then raise exception 'Endereço inválido no link %.', i; end if;
        if k = 'icone' and (v #>> '{}') !~ '^fa-(solid|regular|brands) fa-[a-z0-9-]+$' then raise exception 'Ícone inválido no link %.', i; end if;
        novo := novo || jsonb_build_object(k, v #>> '{}');
      end loop;
      links := links || jsonb_build_array(novo);
    end loop;
  end if;
  return r || jsonb_build_object('links', links);
end; $$;

create or replace function public.cliente_salvar(p_sessao text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; novos jsonb;
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  novos := public.dados_do_cliente(p_dados, pid);
  perform set_config('nfc.autor', 'cliente', true);
  update public.perfis set dados = coalesce(dados, '{}') || novos where id = pid returning dados into novos;
  perform set_config('nfc.autor', '', true);
  return jsonb_build_object('ok', true, 'dados', novos);
end; $$;

-- Usada pela função de envio de fotos: confere a sessão e limita a 30 envios por sessão
create or replace function public.cliente_autorizar_envio(p_sessao text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.cliente_perfil_da_sessao(p_sessao);
begin
  if pid is null then return null; end if;
  update public.sessoes_cliente set envios = envios + 1
  where token_hash = encode(extensions.digest(p_sessao, 'sha256'), 'hex') and envios < 30;
  if not found then return null; end if;
  return pid;
end; $$;

revoke all on function public.guardar_historico(), public.gerar_link_cliente(uuid), public.revogar_link_cliente(uuid),
  public.cliente_entrar(text, text), public.cliente_perfil_da_sessao(text), public.dados_do_cliente(jsonb, uuid),
  public.cliente_salvar(text, jsonb), public.cliente_autorizar_envio(text) from public;
grant execute on function public.gerar_link_cliente(uuid), public.revogar_link_cliente(uuid) to authenticated;
grant execute on function public.cliente_entrar(text, text), public.cliente_salvar(text, jsonb) to anon, authenticated;
grant execute on function public.cliente_autorizar_envio(text) to service_role;
-- O Supabase libera toda função nova para anon e authenticated: as internas ficam só para o banco e a função de fotos
revoke execute on function public.guardar_historico(), public.cliente_perfil_da_sessao(text), public.dados_do_cliente(jsonb, uuid),
  public.cliente_autorizar_envio(text) from anon, authenticated;
revoke execute on function public.gerar_link_cliente(uuid), public.revogar_link_cliente(uuid) from anon;
