## Objetivo

Desacoplar 100% do connector Twilio compartilhado. Cada usuário passa a operar exclusivamente com **as próprias credenciais Twilio** (Account SID + Auth Token) que ele mesmo cadastra na plataforma. Nenhuma chamada à Twilio usa mais `TWILIO_API_KEY`/`LOVABLE_API_KEY` do workspace.

## Modelo de dados (Supabase externo)

Nova tabela para guardar a credencial Twilio do usuário logado (uma por usuário):

```sql
create table public.user_twilio_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_sid text not null,
  auth_token text not null,
  friendly_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_twilio_credentials to authenticated;
grant all on public.user_twilio_credentials to service_role;

alter table public.user_twilio_credentials enable row level security;

create policy "own row select" on public.user_twilio_credentials for select
  to authenticated using (auth.uid() = user_id);
create policy "own row insert" on public.user_twilio_credentials for insert
  to authenticated with check (auth.uid() = user_id);
create policy "own row update" on public.user_twilio_credentials for update
  to authenticated using (auth.uid() = user_id);
create policy "own row delete" on public.user_twilio_credentials for delete
  to authenticated using (auth.uid() = user_id);
```

Observação de segurança: `auth_token` fica em texto plano na tabela (RLS restringe leitura ao próprio dono). Mantemos este trade-off agora para simplicidade — evolução futura: mover para cofre criptografado.

## Mudanças no backend (`src/lib/twilio.functions.ts`)

- Remover `GATEWAY`, `twilioHeaders`, e todo uso de `LOVABLE_API_KEY` / `TWILIO_API_KEY`.
- Novo helper interno que chama diretamente `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/...` usando **HTTP Basic Auth** com o `account_sid` + `auth_token` do usuário logado.
- Todas as server functions autenticadas passam a:
  1. Carregar as credenciais do usuário via `context.supabase.from('user_twilio_credentials')`.
  2. Retornar `{ ok: false, reason: "no_credentials" }` se não houver — o front abre o modal “Conectar Twilio”.
  3. Fazer a chamada Twilio direto com Basic Auth.
- Ajustes específicos:
  - `searchAvailableNumbers`, `purchaseNumber`, `releaseNumber`, `createTwilioAddress`, e a busca de bundle regulatório (v2 Numbering) passam a usar o novo helper.
  - `connectExternalNumber` (BYOC) deixa de ser o único ponto de entrada Twilio: a aba **Twilio** do modal atual passa a **cadastrar/atualizar as credenciais em `user_twilio_credentials`**. Números concretos são adquiridos via `purchaseNumber` como sempre. A aba **SIP Trunk** permanece salvando linhas com `twilio_sid = byoc_...` em `user_phone_numbers`.
  - Nova server function `saveTwilioCredentials({ accountSid, authToken })` — faz um `GET /Accounts/{sid}.json` como validação antes de salvar (upsert).
  - Nova server function `getTwilioConnection()` retornando `{ connected: boolean, accountSid?: string }` (nunca devolve o token).
  - Nova server function `disconnectTwilio()` — deleta a linha de credenciais.

## Mudanças no frontend (`src/routes/_authenticated/telefonia.tsx`)

- Ao abrir a tela, chamar `getTwilioConnection`. Se `connected === false`, deixar KPIs zerados e mostrar um estado vazio com CTA "Conectar Twilio" que abre o mesmo modal atual.
- Modal “Conectar Número de Telefonia”:
  - Aba **Twilio** deixa de exigir “Número de Telefone Adquirido” — passa a ser apenas **Account SID + Auth Token** (com botão de olho para revelar) e um botão "Conectar Twilio" que chama `saveTwilioCredentials`. Sucesso → toast + fecha modal + habilita compra.
  - Aba **SIP Trunk** intacta.
- Fluxo de compra: mantém o botão “Adquirir número”, mas só é habilitado quando `connected === true`. Toda a busca + compra usa `searchAvailableNumbers` / `purchaseNumber`, que agora respondem com **os números da conta Twilio do próprio usuário**.
- Adicionar em algum ponto da UI (menu do topo do card ou um novo botão “Twilio conectado: AC1234…”) um "Desconectar Twilio" com `AlertDialog` chamando `disconnectTwilio`.
- Coluna Provedor da tabela: números vindos de `purchaseNumber` passam a exibir “Twilio (Sua conta)”.

## O que sai do projeto

- Nenhuma referência a `LOVABLE_API_KEY` ou `TWILIO_API_KEY` no runtime dessa página/funcões.
- `standard_connectors--disconnect` do connector Twilio (informo o `connection_id` durante a execução para desvincular do projeto).

## Requisitos do usuário

1. Confirmar este plano.
2. Rodar o SQL da tabela `user_twilio_credentials` no SQL Editor do Supabase externo.
3. Ter em mãos `Account SID` e `Auth Token` da sua Twilio para conectar após o deploy (não precisa enviar no chat — a tela pede).

## Verificação

- Sem credenciais: tela mostra estado “Twilio não conectado”; busca/compra bloqueadas.
- Com credenciais de usuário A: A vê apenas números de A; usuário B (sem credenciais ou com outras credenciais) não enxerga nada de A.
- Desconectar Twilio: números salvos localmente permanecem na tabela `user_phone_numbers`, mas novas buscas/compras ficam bloqueadas até reconectar.
- Erros Twilio (SID inválido, token inválido, 401) são exibidos no toast com a mensagem original do provider.
