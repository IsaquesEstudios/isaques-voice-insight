## Objetivo

Executar o plano de compra de números Twilio vinculados ao usuário logado, usando um **projeto Supabase externo** (BYO Supabase) — não o Lovable Cloud.

## Como o multi-tenant funciona

Uma única conta Twilio (compartilhada via connector do workspace) executa as compras. O “vínculo por usuário” fica no **Supabase externo**: cada linha em `user_phone_numbers` grava `auth.uid()`, e RLS garante que cada usuário só enxerga os seus números.

## Passos

### 1. Conectar o Supabase externo
Você precisa fornecer três valores do seu projeto Supabase (Settings → API):
- `SUPABASE_URL` (ex.: `https://xxxx.supabase.co`)
- `SUPABASE_PUBLISHABLE_KEY` (a chave `anon` / publishable)
- `SUPABASE_SERVICE_ROLE_KEY` (service_role — server-only)

Também versões `VITE_*` (mesmos valores da URL e da publishable) para o cliente. Eu adiciono via `add_secret` (formulário seguro); nada é digitado no chat.

Depois configuro manualmente os arquivos de integração equivalentes ao Lovable Cloud (sem usar `supabase--enable`, que provisiona um novo projeto):
- `src/integrations/supabase/client.ts` (browser, publishable key).
- `src/integrations/supabase/client.server.ts` (service role — só carregado dentro de handlers).
- `src/integrations/supabase/auth-middleware.ts` (`requireSupabaseAuth` para server functions).
- `src/integrations/supabase/auth-attacher.ts` + append no `functionMiddleware` em `src/start.ts` para anexar o bearer.
- `src/integrations/supabase/types.ts` gerado do schema.

### 2. Schema no Supabase externo
Você roda esta migration no SQL Editor do seu Supabase (envio o SQL pronto):

```sql
create table public.user_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  twilio_sid text not null unique,
  phone_number text not null,
  friendly_name text,
  region text,
  country_iso text,
  capabilities jsonb default '{}'::jsonb,
  monthly_cost text,
  provider text not null default 'twilio',
  assistant text,
  health text not null default 'Seguro',
  calls_today int not null default 0,
  answer_rate int not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_phone_numbers to authenticated;
grant all on public.user_phone_numbers to service_role;

alter table public.user_phone_numbers enable row level security;

create policy "own select" on public.user_phone_numbers for select
  to authenticated using (auth.uid() = user_id);
create policy "own insert" on public.user_phone_numbers for insert
  to authenticated with check (auth.uid() = user_id);
create policy "own update" on public.user_phone_numbers for update
  to authenticated using (auth.uid() = user_id);
create policy "own delete" on public.user_phone_numbers for delete
  to authenticated using (auth.uid() = user_id);
```

Sem tabela `profiles` neste momento — só `auth.users.id` já basta.

### 3. Auth (e-mail + senha) e rota protegida
- Nova rota pública `src/routes/auth.tsx` com formulários de sign-in e sign-up usando `supabase.auth.signInWithPassword` / `signUp`.
- Layout protegido `src/routes/_authenticated/route.tsx` (`ssr: false`) que redireciona para `/auth` quando `getUser()` falha.
- Mover `src/routes/telefonia.tsx` → `src/routes/_authenticated/telefonia.tsx` (design intacto).
- Wiring no `__root.tsx`: `supabase.auth.onAuthStateChange` chamando `router.invalidate()` em `SIGNED_IN/OUT/USER_UPDATED` e `queryClient.invalidateQueries()` quando não é sign-out.
- Um botão de sign-out no topbar seguindo o padrão “cancel + clear + signOut + navigate('/auth', replace)”.

### 4. Vincular a conexão Twilio ao projeto
- Rodar o `connect` do connector Twilio (a conexão “Isaques's Twilio” já existe no workspace, mas ainda não está vinculada a este projeto) para injetar `TWILIO_API_KEY` + `LOVABLE_API_KEY` no runtime do servidor.
- Todas as chamadas passam por `https://connector-gateway.lovable.dev/twilio/...`, nunca do cliente.

### 5. Server functions em `src/lib/twilio.functions.ts`
Todas com `createServerFn` + `.middleware([requireSupabaseAuth])`:
- `searchAvailableNumbers({ country, areaCode })` → `GET /AvailablePhoneNumbers/{country}/Local.json?AreaCode=...`.
- `purchaseNumber({ phoneNumber })` → `POST /IncomingPhoneNumbers.json` (form-urlencoded). Ao sucesso, `context.supabase.from('user_phone_numbers').insert({...})` com `user_id: context.userId` e `twilio_sid` retornado.
- `listMyNumbers()` → `SELECT * FROM user_phone_numbers` (RLS filtra por `auth.uid()`).
- `releaseNumber({ id })` → busca o `twilio_sid` do próprio usuário, `DELETE /IncomingPhoneNumbers/{sid}.json`, depois `DELETE` da linha.

Erros da Twilio (código + mensagem) são retornados intactos para o toast.

### 6. `_authenticated/telefonia.tsx`
- Substituir `initialNumbers` mock por `useQuery(['my-numbers'], listMyNumbers)` + skeleton (o desenho glass permanece).
- `handleSearch` chama `searchAvailableNumbers`; `handleBuy` chama `purchaseNumber` e faz `invalidateQueries(['my-numbers'])`.
- KPIs derivados da query.
- Menu `MoreVertical` ganha ação “Liberar número” com `AlertDialog` chamando `releaseNumber`.

### 7. Verificação
- Criar dois usuários; cada um compra um número e vê só os seus na tabela.
- Query direta no Supabase confirmando `user_id` correto.
- Forçar erro Twilio (área inválida) e conferir que a mensagem do provider aparece no toast.

## O que NÃO muda
- Layout/glass da página de Telefonia permanece igual.
- Somente `src/routes/telefonia.tsx` (movida para `_authenticated/`), `src/routes/__root.tsx` (auth listener + sign-out) e arquivos novos (integração Supabase, `auth.tsx`, `_authenticated/route.tsx`, `twilio.functions.ts`) são tocados.

## Requisitos do usuário antes de eu implementar
1. Confirmar que quer avançar com este plano.
2. Ter em mãos, do projeto Supabase externo: URL, `anon` key e `service_role` key (vou abrir formulário seguro do `add_secret` para cada um — não cole no chat).
3. Autorização para vincular a conexão “Isaques's Twilio” a este projeto (rodo o `connect`).
4. Após a implementação, você roda o SQL da seção 2 no SQL Editor do seu Supabase.
