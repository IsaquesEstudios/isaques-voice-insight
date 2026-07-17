
## Objetivo

Substituir os mocks das abas **Logs** e **Analysis** em `src/routes/_authenticated/assistants.$id.tsx` por dados reais da API oficial da Vapi, usando dois endpoints:

- `GET /call?assistantId=...` — lista de chamadas do assistente (o `/logs` foi descontinuado, este é o substituto oficial recomendado no fórum e SDK).
- `POST /analytics` — agregações oficiais (`sum`, `avg`, `count`) sobre a tabela `call` com `groupBy` e `timeRange`, exatamente como o dashboard da Vapi usa.

Tudo passa por server functions com `VAPI_PRIVATE_KEY` (nada de chamada direta do navegador).

---

## 1) Server functions novas em `src/lib/vapi.functions.ts`

### a) `listAssistantCalls({ assistantId, limit? })`
- `GET /call?assistantId=<id>&limit=<n>` (default 50, máx 100).
- Retorna DTO enxuto por chamada (não devolver o objeto cru): `id`, `startedAt`, `endedAt`, `durationSec`, `cost`, `costBreakdown` (stt/llm/tts/vapi/transport), `endedReason`, `status`, `type` (inbound/outbound/web), `customerNumber`, `phoneNumber` (o E.164 do número Vapi), `recordingUrl` (`artifact.recordingUrl` / `stereoRecordingUrl`), `transcript` (`artifact.transcript`), `summary` (`analysis.summary`), `successEvaluation` (`analysis.successEvaluation`), `structuredData` (`analysis.structuredData`).

### b) `getAssistantAnalytics({ assistantId, rangeDays })`
- `POST /analytics` com um único body carregando várias queries (`table: "call"`, filtradas por assistente via `groupBy: "assistantId"` — a API não tem filtro direto, então filtramos os buckets pelo `assistantId` no retorno).
- Queries que vamos enviar:
  1. `totals` — `operations: [count(id), sum(duration), sum(minutesUsed), sum(cost)]`, sem step (total no período).
  2. `daily` — mesmo `operations`, com `timeRange.step: "day"` para série temporal.
  3. `byEndedReason` — `groupBy: "endedReason"`, `operations: [count(id)]`.
  4. `bySuccess` — `groupBy: "analysis.successEvaluation"`, `operations: [count(id)]`.
  5. `costBreakdown` — `operations: [sum(costBreakdown.stt), sum(costBreakdown.llm), sum(costBreakdown.tts), sum(costBreakdown.vapi), sum(costBreakdown.transport)]`.
- `timeRange.start` = agora − `rangeDays`, `timeRange.end` = agora, `timezone` = `America/Sao_Paulo`.
- Retorno DTO: `{ totals, daily: [{date,count,minutes,cost}], endedReasons: [{reason,count}], success: [{label,count}], costBreakdown: {stt,llm,tts,vapi,transport} }`.

Ambas usam `requireSupabaseAuth` e devolvem `{ error }` em vez de lançar quando a Vapi responder 4xx, para a UI mostrar estado vazio sem quebrar.

---

## 2) `LogsTab` — dados reais

Substitui `MOCK_LOGS`. Estrutura mantém o card glass atual, só troca o conteúdo:

- `useSuspenseQuery` via `listAssistantCalls({ assistantId })` com `staleTime: 30s` (dá sensação instantânea ao trocar de aba, respeitando o cache global já configurado).
- Skeleton loader (mesmo padrão das outras abas) enquanto carrega; empty state ("Nenhuma ligação registrada ainda para este assistente") quando `[]`.
- Colunas: Data/Hora (pt-BR), Origem/Destino (customerNumber → phoneNumber), Duração (`mm:ss`), Custo (`$0.00`), Motivo de término (badge), Ações.
- Ações por linha:
  - ▶ **Reproduzir**: abre um `<Dialog>` com `<audio controls src={recordingUrl}>` (funciona pois a Vapi devolve URL curta assinada).
  - 📄 **Transcrição**: `<Dialog>` mostrando `transcript` em pre-wrap + `summary` acima quando existir.
- Botão "Atualizar" no header do card chama `queryClient.invalidateQueries`.

Sem paginação nesta primeira versão — só o botão “Carregar mais” incrementando `limit` (50 → 100 → 200).

---

## 3) `AnalysisTab` — dados reais + mantém configuração

O que existe hoje (Critério de Sucesso e Extração de Dados) é **configuração do assistente**, não análise. Fica preservado no fim da aba, dentro de uma seção "Configuração da análise". No topo passa a mostrar métricas reais da Vapi.

- `useSuspenseQuery` de `getAssistantAnalytics({ assistantId, rangeDays })`.
- Seletor de período: **7d / 30d / 90d** (default 7).
- KPIs (cards glass, 4 colunas): Total de chamadas, Minutos falados, Custo total, Custo médio por minuto (derivado).
- Gráfico **Volume por dia** (bar chart) usando `recharts` (já disponível no template shadcn) a partir de `daily`.
- Gráfico **Custo por componente** (pie/stacked bar) a partir de `costBreakdown` (STT/LLM/TTS/Vapi/Transport).
- Tabela **Motivos de término** (`endedReasons`) — count por `endedReason`, ordenado desc, com badge colorido.
- Tabela **Avaliação de sucesso** (`success`) — count por valor de `analysis.successEvaluation` (`pass`/`fail`/`unknown`).
- Estados de erro/vazio explícitos em pt-BR (“Sem chamadas no período selecionado”, “API da Vapi indisponível: <mensagem>”).

---

## 4) Detalhes técnicos

- Reaproveita `vapiFetch` de `src/lib/vapi.functions.ts` (já traduz erros para pt-BR).
- Novas funções ficam em `.functions.ts` (nada de import server-only em cima de rota).
- Não muda a UI de outras abas nem o preset selector.
- Sem novas dependências: `recharts` já é usado pelos componentes shadcn `chart`.

### Arquivos afetados
- `src/lib/vapi.functions.ts` — adiciona `listAssistantCalls`, `getAssistantAnalytics` e tipos DTO.
- `src/routes/_authenticated/assistants.$id.tsx` — reescreve `LogsTab` e `AnalysisTab` (remove `MOCK_LOGS`), adiciona dialogs de recording/transcript e os gráficos.

### Fora de escopo
- Filtros avançados (por número, por status).
- Paginação com cursor.
- Alterar o preset selector, tools, telefonia ou outras páginas.
