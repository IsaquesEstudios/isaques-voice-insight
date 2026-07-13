# Assistentes vinculados ao usuário

A Vapi não tem conceito de "usuário final" — todas as assistentes ficam na sua conta única. A forma correta é manter a Vapi como está (usando sua `VAPI_PRIVATE_KEY`) e criar uma tabela de propriedade no Supabase que mapeia `vapi_assistant_id → user_id`. Toda listagem/edição/exclusão é filtrada por essa tabela.

## O que muda

### 1. Banco (Supabase)
Nova tabela `user_assistants`:
```
id uuid PK
user_id uuid  (auth.users)
vapi_assistant_id text UNIQUE
created_at timestamptz
```
- RLS: cada usuário só vê/insere/deleta linhas onde `user_id = auth.uid()`.
- Índice em `(user_id)`.

### 2. Rotas protegidas
Mover para o layout autenticado (mesmo padrão de `/telefonia`):
- `src/routes/assistentes.tsx` → `src/routes/_authenticated/assistentes.tsx`
- `src/routes/assistants.$id.tsx` → `src/routes/_authenticated/assistants.$id.tsx`

Sem login → redireciona para `/auth`.

### 3. Server functions (`src/lib/vapi.functions.ts`)
Adicionar `requireSupabaseAuth` em todas as funções e cruzar Vapi com a tabela `user_assistants`:

- `listVapiAssistants`: busca `vapi_assistant_id` do usuário na tabela → busca `/assistant` na Vapi → devolve só os que pertencem ao usuário.
- `createVapiAssistant` / `duplicateVapiAssistant`: cria na Vapi, depois insere `(user_id, vapi_assistant_id)` na tabela. Se o insert falhar, deleta o assistente órfão na Vapi.
- `getVapiAssistant` / `updateVapiAssistant` / `saveVapiAssistantConfig` / `deleteVapiAssistant`: antes de qualquer chamada Vapi, valida que existe linha `(user_id, vapi_assistant_id)`. Se não, retorna 403.

### 4. UI
Nenhuma mudança visual. Só invalida queries no login/logout (já feito no `__root.tsx`).

## Migração de dados existentes
Assistentes criadas antes desta mudança não têm dono. Duas opções (me diga qual):
- **(A)** Ignorar: viram invisíveis para todos e permanecem só na sua conta Vapi.
- **(B)** Atribuir todas as assistentes atualmente na Vapi ao seu usuário (o admin). Executo uma vez após o deploy.

## Detalhes técnicos
- A chave `VAPI_PRIVATE_KEY` continua exclusivamente no servidor — o front nunca vê.
- A validação de posse acontece no handler antes de qualquer `fetch` para Vapi, então nem GET vaza para outro usuário.
- Ao deletar um usuário no Supabase, o `ON DELETE CASCADE` remove as linhas de `user_assistants` (mas o assistente na Vapi fica; posso adicionar limpeza posterior se quiser).

Confirma o plano e escolhe A ou B para a migração?
