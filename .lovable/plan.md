## Objetivo
Permitir que cada número da página `/telefonia` tenha uma **atendente (assistente virtual do Vapi) responsável**, para que ligações recebidas nesse número sejam atendidas por ela.

## Como vai funcionar (usuário)
1. Na tabela "Meus números", cada linha ganha um botão "Atribuir atendente" (ou o próprio nome da atendente, clicável) na coluna **Atendente**.
2. Ao clicar, abre um modal com combobox listando as assistentes da conta (via `listAssistants` já existente).
3. Escolher uma atendente → salva o vínculo, importa o número no Vapi (se ainda não importado) e liga a assistente a ele. Toast de sucesso e refresh automático da lista.
4. Também é possível trocar a atendente ou "Remover atendente" pelo mesmo modal.
5. A coluna "Atendente" passa a mostrar o nome real (não só um id) e a origem do vínculo (Vapi).

## Arquitetura técnica

### Backend — Vapi Phone Numbers API
Adicionar em `src/lib/vapi.functions.ts` (todas com `requireSupabaseAuth`):

- `listVapiPhoneNumbers()` → `GET /phone-number` (retorna os números já importados no Vapi da conta).
- `attachAssistantToNumber({ phoneNumberE164, twilioSid, assistantId })`:
  - Procura o número em `listVapiPhoneNumbers` pelo `number` em E.164.
  - Se **não existir**: `POST /phone-number` com `{ provider: "twilio", number, twilioAccountSid, twilioAuthToken, assistantId, name }` usando as credenciais Twilio do usuário lidas de `user_twilio_credentials` (mesma tabela já usada por `twilio.functions.ts`).
  - Se **existir**: `PATCH /phone-number/{id}` com `{ assistantId }`.
- `detachAssistantFromNumber({ phoneNumberE164 })` → `PATCH /phone-number/{id}` com `{ assistantId: null }`.

Espelhar o vínculo no Supabase para exibição rápida: adicionar coluna `assistant_id uuid null` (Vapi assistant id, texto) em `user_phone_numbers` — via migration — e atualizar `listUserPhoneNumbers` / `connectExternalNumber` para retornar/preservar esse campo.

### Frontend — `src/routes/_authenticated/telefonia.tsx`
- Novo estado `assignTarget: UserPhoneNumber | null` e `AssignAssistantDialog`.
- Dentro do dialog: `useQuery(["assistants"], listAssistants)` para popular um `<Select>` com nome + provider + voice.
- Mutation `attachAssistantMutation` → chama `attachAssistantToNumber` e faz `queryClient.invalidateQueries(["user-phone-numbers"])`.
- Coluna **Atendente** (linha 586): mostrar nome da atendente (lookup via mapa `assistants`), com botão "Atribuir/Alterar". No `DropdownMenu` da linha, adicionar itens "Atribuir atendente" e "Remover atendente".

### Migration
```sql
ALTER TABLE public.user_phone_numbers
  ADD COLUMN IF NOT EXISTS assistant_id text,
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id text;
```
Sem mudanças de RLS (já escopadas por `user_id`).

## Escopo fora
- Não altero fluxo de compra/conexão de números existente.
- Não altero a página `/assistants`.
- Sem inbound webhook próprio — o Vapi cuida de atender via a assistente vinculada.

## Arquivos afetados
- `src/lib/vapi.functions.ts` (novas funções)
- `src/routes/_authenticated/telefonia.tsx` (UI/mutations)
- Nova migration para colunas em `user_phone_numbers`
