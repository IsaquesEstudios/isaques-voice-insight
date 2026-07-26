## Contexto

A Vapi **não expõe um endpoint oficial de saldo/créditos** na sua API pública. A documentação oficial (`docs.vapi.ai/api-reference.md`) não contém rotas de `/org`, `/subscription`, `/credit`, `/billing` ou `/balance`, e posts na comunidade da Vapi confirmam que não há endpoint direto para consultar créditos restantes.

Hoje o app tenta adivinhar créditos via `/org` e `/subscription`, mas essas rotas não existem na API documentada, então o card de Vapi fica sem valor real.

## Objetivo

Implementar uma gestão de créditos Vapi baseada em **dados reais que a API fornece**: o histórico de chamadas (`GET /call`). O usuário informa seu crédito/orçamento Vapi e o app calcula o saldo estimado subtraindo os gastos reais das chamadas.

## Plano de implementação

### 1. Schema e persistência
- Criar migration `docs/migrations/20260726_user_vapi_settings.sql`.
- Tabela `public.user_vapi_settings`:
  - `user_id uuid PK` (referência `auth.users`).
  - `credits_budget numeric` — crédito/orçamento que o usuário informa ter na Vapi.
  - `low_balance_threshold numeric` — percentual (0–1) para alerta visual (default 0.2).
  - `created_at`, `updated_at`.
- GRANTs e RLS padrão (usuário vê/altera só o próprio registro).

### 2. Server function de créditos estimados
- No `src/lib/vapi.functions.ts`, substituir/adicionar `getVapiEstimatedCredits`:
  - Lê `credits_budget` e `low_balance_threshold` de `user_vapi_settings`.
  - Chama `GET /call` da Vapi (já autenticado com a chave do usuário) e busca as chamadas dos últimos 90 dias.
  - Soma o campo `cost` de cada chamada (quando presente); se ausente, estima por `durationMinutes * tarifa_padrão`.
  - Retorna DTO: `{ ok, budget, spent, balance, currency, usageRatio, lowBalance, callsCount, lastCallAt, error }`.
- Manter `getVapiCredits` como fallback com mensagem clara de que a API não expõe saldo, ou removê-lo se não for mais usado.

### 3. UI de configuração do orçamento
- Em `src/routes/_authenticated/configuracoes.tsx`, na aba Faturamento:
  - Adicionar um pequeno formulário no card da Vapi para o usuário informar seu crédito/orçamento.
  - Campo numérico em USD.
  - Slider ou input para percentual de alerta de saldo baixo.
  - Botão "Salvar orçamento".
- Mostrar no card:
  - Orçamento configurado.
  - Gasto acumulado (estimado).
  - Saldo restante.
  - Barra de progresso baseada em `usageRatio`.
  - Badge/alerta quando `lowBalance` for verdadeiro.

### 4. Atualizar o sidebar
- Em `src/components/app-sidebar.tsx`, substituir `getVapiCredits` por `getVapiEstimatedCredits`.
- Mostrar o saldo estimado (`balance`) e, quando colapsado, um indicador de cor (verde/amarelo/vermelho) conforme o percentual de uso.

### 5. Segurança e validações
- A server function deve usar `withVapiCredentials` para garantir que só usuários com Vapi configurado acessem.
- RLS na tabela `user_vapi_settings`.
- Arredondar valores para 4 casas decimais.

## Resultado esperado

- O card de Vapi passa a mostrar um **saldo estimado real** baseado nas chamadas feitas.
- O usuário tem controle sobre seu orçamento e recebe alerta visual de saldo baixo.
- Removemos a dependência de endpoints inexistentes da Vapi.

## Notas técnicas

- A Vapi retorna `cost` em dólares no objeto de call; usaremos isso como fonte primária.
- Se `cost` não estiver presente, usaremos uma estimativa conservadora baseada em minutos.
- A recarga de créditos continua sendo feita diretamente no dashboard da Vapi; o app só lê e projeta o saldo.