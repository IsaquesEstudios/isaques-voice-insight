-- ===========================================================
-- Omniasyn — WhatsApp 100% no banco externo
-- Rode este script UMA VEZ no SQL Editor do seu Supabase externo.
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ===========================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Função de updated_at ------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Contas WhatsApp (WABA) -------------------------------------------
create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  waba_id text not null,
  access_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, waba_id)
);
create index if not exists whatsapp_accounts_user_idx on public.whatsapp_accounts (user_id);

-- 2) Números -----------------------------------------------------------
create table if not exists public.whatsapp_numeros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  waba_id text not null,
  phone_number_id text not null unique,
  display_phone_number text,
  verified_name text,
  status text not null default 'pendente',
  whatsapp_ai_agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_numeros_user_idx on public.whatsapp_numeros (user_id);

-- 3) Conversas e mensagens --------------------------------------------
create table if not exists public.whatsapp_conversas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  phone_number_id text not null,
  contato_wa_id text not null,
  contato_nome text,
  ultima_mensagem text,
  ultima_em timestamptz not null default now(),
  nao_lidas integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number_id, contato_wa_id)
);
create index if not exists whatsapp_conversas_user_idx on public.whatsapp_conversas (user_id, ultima_em desc);

create table if not exists public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.whatsapp_conversas(id) on delete cascade,
  user_id uuid not null,
  wa_message_id text,
  direcao text not null,
  tipo text not null default 'text',
  texto text,
  status text,
  media_id text,
  media_mime text,
  media_nome text,
  criado_em timestamptz not null default now()
);
create index if not exists whatsapp_mensagens_conversa_idx on public.whatsapp_mensagens (conversa_id, criado_em);
alter table public.whatsapp_mensagens add column if not exists media_id text;
alter table public.whatsapp_mensagens add column if not exists media_mime text;
alter table public.whatsapp_mensagens add column if not exists media_nome text;

-- 4) Assistentes de IA -------------------------------------------------
create table if not exists public.whatsapp_ai_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  provider text not null default 'gemini',
  area text not null,
  mission text not null,
  tone text not null,
  emoji_usage text not null,
  language text not null default 'pt-BR',
  response_length text not null,
  restrictions text not null default '',
  knowledge text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_ai_agents_user_idx on public.whatsapp_ai_agents (user_id);

create table if not exists public.whatsapp_ai_credentials (
  user_id uuid primary key,
  gemini_api_key_ciphertext text not null,
  gemini_api_key_last_four text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_ai_conversation_controls (
  user_id uuid not null,
  conversation_id uuid not null,
  manual_takeover boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create table if not exists public.whatsapp_ai_runs (
  inbound_message_id text primary key,
  user_id uuid not null,
  conversation_id uuid not null,
  agent_id uuid references public.whatsapp_ai_agents(id) on delete set null,
  status text not null default 'processing',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) Disparos: campanhas e lembretes -----------------------------------
create table if not exists public.whatsapp_campanhas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  phone_number_id text not null,
  template_name text not null,
  template_lang text not null,
  componentes jsonb not null default '{}'::jsonb,
  status text not null default 'agendada',
  agendada_para timestamptz,
  total integer not null default 0,
  enviados integer not null default 0,
  falhas integer not null default 0,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_campanhas_user_idx on public.whatsapp_campanhas (user_id, created_at desc);
create index if not exists whatsapp_campanhas_agenda_idx on public.whatsapp_campanhas (status, agendada_para);

create table if not exists public.whatsapp_campanha_contatos (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.whatsapp_campanhas(id) on delete cascade,
  user_id uuid not null,
  nome text,
  telefone text not null,
  variaveis jsonb not null default '[]'::jsonb,
  status text not null default 'pendente',
  erro text,
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_campanha_contatos_idx on public.whatsapp_campanha_contatos (campanha_id, created_at);

create table if not exists public.whatsapp_lembretes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  telefone text not null,
  phone_number_id text not null,
  template_name text not null,
  template_lang text not null,
  variaveis jsonb not null default '[]'::jsonb,
  componentes jsonb not null default '{}'::jsonb,
  agendado_para timestamptz not null,
  status text not null default 'agendado',
  erro text,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_lembretes_agenda_idx on public.whatsapp_lembretes (status, agendado_para);

-- 6) Triggers de updated_at -------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'whatsapp_accounts','whatsapp_numeros','whatsapp_conversas',
    'whatsapp_ai_agents','whatsapp_ai_credentials','whatsapp_ai_conversation_controls',
    'whatsapp_ai_runs','whatsapp_campanhas','whatsapp_lembretes'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.update_updated_at_column()', t);
  end loop;
end $$;

-- 7) Permissões e RLS --------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'whatsapp_accounts','whatsapp_numeros','whatsapp_conversas','whatsapp_mensagens',
    'whatsapp_ai_agents','whatsapp_ai_credentials','whatsapp_ai_conversation_controls',
    'whatsapp_ai_runs','whatsapp_campanhas','whatsapp_campanha_contatos','whatsapp_lembretes'
  ] loop
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Leitura em tempo real no painel (apenas do próprio usuário)
grant select on public.whatsapp_conversas to authenticated;
grant select on public.whatsapp_mensagens to authenticated;

drop policy if exists "ler proprias conversas" on public.whatsapp_conversas;
create policy "ler proprias conversas" on public.whatsapp_conversas
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ler proprias mensagens" on public.whatsapp_mensagens;
create policy "ler proprias mensagens" on public.whatsapp_mensagens
  for select to authenticated using (auth.uid() = user_id);

-- 8) Realtime ----------------------------------------------------------
alter table public.whatsapp_conversas replica identity full;
alter table public.whatsapp_mensagens replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.whatsapp_conversas;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.whatsapp_mensagens;
  exception when duplicate_object then null; end;
end $$;

-- 9) Agendamento interno dos disparos (uma vez só, vale para todas as contas)
select cron.unschedule('omniasyn-disparos')
where exists (select 1 from cron.job where jobname = 'omniasyn-disparos');

select cron.schedule(
  'omniasyn-disparos',
  '* * * * *',
  $$ select net.http_post(url := 'https://app.omniasyn.com/api/public/cron/whatsapp-disparos?secret=S2Ez7u2tUMd01EW6KkPRkErfzPd5Y7XPNg9JnJgt49xc7QDb') $$
);
