## Objetivo

Fazer o card do preset "Matteus" exibir custo e latência reais da conta Vapi do usuário — os mesmos valores que aparecem no painel oficial da Vapi — em vez da estimativa da tabela pública.

## Onde já está certo

- CRUD, ligações e billing já batem na API oficial (`https://api.vapi.ai`) com `VAPI_PRIVATE_KEY`, então cada chamada é executada e cobrada pela Vapi de verdade.
- Já existe `getAssistantCallStats` (`src/lib/vapi.functions.ts`) que consulta `/call?assistantId=...` e a UI (`src/routes/_authenticated/assistants.$id.tsx`) já tem `useQuery` para essas stats.

## O que está errado hoje

O card mostrou `Custo real $0.078/min · Latência real ~6.25s`, que não bate com o painel da Vapi. Duas causas prováveis:

1. Custo é derivado de `call.cost / duração`, o que inclui variações por chamada; a Vapi expõe `costBreakdown` (stt/llm/tts/vapi) por chamada, que é o valor exato do painel.
2. Latência é medida via gap entre `messages[i].endTime` e `messages[i+1].time` (user → assistant). Isso captura o tempo de fala/silêncio do usuário, não a latência real do modelo, inflando para vários segundos.

## Mudanças

### 1. `src/lib/vapi.functions.ts` — `getAssistantCallStats`

- Continuar chamando `GET /call?assistantId=...&limit=50`.
- **Custo real**: quando `call.costBreakdown` existir, somar `stt + llm + tts + vapi` e dividir pela duração (min); é o mesmo número do painel. Cair para `call.cost / durMin` se breakdown não vier.
- **Latência real**: em vez do gap entre mensagens, usar campos de performance por mensagem. A Vapi anexa em cada mensagem assistant um `duration` (ms de geração) e o Vapi também expõe `call.analysis` / `call.messages` com `secondsFromStart`. Estratégia:
  - Preferir, se presente, `call.performanceMetrics` / `call.analysis.averageResponseLatency` (campo direto).
  - Fallback: para cada par `user → assistant`, medir gap só quando `gap < 5000ms` (descarta silêncios humanos); tomar o menor gap por chamada e depois média entre chamadas, aproximando "response latency" do painel.
- Retornar também `avgCostPerMinBreakdown` separando `stt`, `llm`, `tts`, `vapi` para permitir tooltip com o detalhamento (opcional, mesmo shape que o painel Vapi).

### 2. `src/routes/_authenticated/assistants.$id.tsx` — card do preset

- Já lê `callStatsQuery.data`; manter a lógica de mostrar valor real quando `callCount > 0`.
- Ajustar o rótulo/tooltip: `Custo real` mostra `$X/min` com breakdown no tooltip (`STT $ · LLM $ · TTS $ · Vapi $`), `Latência real` mostra `~Ns` (média Vapi).
- Se `callCount === 0`, continuar exibindo a estimativa (fallback atual).

### 3. Sem mudanças

- Nada de novo secret; `VAPI_PRIVATE_KEY` já configurada.
- Sem alteração no fluxo de criação/edição do assistente.
- Sem alteração no `vapi-pricing.ts` (continua servindo de fallback quando não há chamadas).

## Como validar

1. Abrir `/assistants/<id>` do "Matteus".
2. Card deve mostrar `Custo real ~$…/min` com valor próximo ao total do painel Vapi (ex.: soma de STT+LLM+TTS+Vapi) e `Latência real ~Ns` compatível com o painel.
3. Tooltip do custo mostra breakdown por componente.
4. Assistente novo (sem chamadas): card volta a mostrar a estimativa da tabela oficial.
