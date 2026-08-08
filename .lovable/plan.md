# Faturamento real da Vapi no painel

Hoje o painel não mostra faturamento de verdade: o card "Faturamento" (Configurações) e a barra de saldo na lateral usam um número estimado — um orçamento que o próprio usuário digita, menos o custo das chamadas dos últimos 90 dias (e limitado às 100 chamadas mais recentes). Nada disso vem da conta da Vapi.

## O que muda

**1. Dados puxados direto da conta Vapi**
- O painel passa a consultar a API oficial de analytics da Vapi com a chave do próprio cliente e trazer o gasto real:
  - Gasto do mês atual e do mês anterior.
  - Gasto dos últimos 12 meses (série mensal).
  - Minutos usados e número de chamadas do período.
  - Composição do custo: modelo de IA (LLM), transcrição, voz (TTS), plataforma Vapi e transporte/telefonia.
- Também tentamos ler os dados da organização na Vapi (nome, plano e limite de cobrança). Se a Vapi não devolver, o painel simplesmente não mostra esses campos — sem quebrar nada.

**2. Card "Faturamento" reescrito (Configurações)**
- Blocos com: **Gasto no mês atual**, **Mês anterior**, **Minutos usados** e **Chamadas**.
- Tabela/gráfico simples com os últimos 12 meses.
- Detalhamento do custo por componente (LLM, STT, TTS, Vapi, telefonia) do mês atual.
- Botão de atualizar mantido, com data/hora da última sincronização.
- O campo de orçamento continua existindo, mas passa a ser opcional e claramente rotulado como "limite de alerta" — não é mais a base do que é exibido como gasto.

**3. Barra lateral**
- A linha "Vapi" deixa de mostrar "saldo estimado" e passa a mostrar o **gasto do mês atual** (real), com a barra de progresso relativa ao orçamento/limite quando ele estiver configurado.
- O selo "estimado" só aparece se, e quando, o número exibido for estimado.

**4. Erros visíveis**
- Se a chave Vapi estiver inválida ou a API falhar, o card mostra a mensagem de erro traduzida em vez de exibir zeros.

## Detalhes técnicos

- Nova server function `getVapiBilling` em `src/lib/vapi.functions.ts` (middleware `withVapiCredentials`), retornando um DTO com: `currentMonth`, `previousMonth`, `monthly[]`, `breakdown`, `minutesUsed`, `callsCount`, `org` (nome/plano/billingLimit, opcional) e `error`.
  - Fonte principal: `POST /analytics` (tabela `call`) com `operations: sum(cost)`, `sum(minutesUsed)`, `count(id)` e `timeRange.step = "month"`, mais uma query específica do mês corrente com as colunas `costBreakdown.*`. Timezone `America/Sao_Paulo`.
  - Fonte complementar: `GET /org` (existe na API, porém não documentada — retorna 401 sem chave). Chamada dentro de `try/catch`; falha aqui não invalida o restante.
- `getVapiEstimatedCredits` continua existindo apenas para o cálculo do alerta de orçamento; os componentes deixam de usá-la como fonte de gasto.
- UI: `FaturamentoSection` em `src/routes/_authenticated/configuracoes.tsx` e `SidebarCredits` em `src/components/app-sidebar.tsx` passam a consumir `getVapiBilling` (query key `vapi-billing`), mantendo skeletons e o visual atual.
- Sem mudanças de banco de dados.
