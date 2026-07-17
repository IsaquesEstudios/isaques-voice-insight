# Corrigir custo real no card do preset para bater com o painel Vapi

## Diagnóstico (confirmado em `src/lib/vapi.functions.ts` 1085-1206)
- Somamos apenas `costBreakdown.stt + llm + tts + vapi`, descartando `transport`, `analysis`, `knowledgeBase`, `chat` e outros itens que o painel Vapi inclui no custo total da chamada.
- Calculamos `cost/min` por chamada e depois `avg(...)` — média simples. O painel usa média ponderada por duração (Σcusto / Σminutos), o que produz um valor diferente (normalmente maior, alinhado à realidade da fatura).
- Filtro `durSec > 5` exclui chamadas curtas que o painel ainda contabiliza.

## Mudanças

### `src/lib/vapi.functions.ts` — `getAssistantCallStats`
1. Trocar o cálculo de custo para usar o **total real da chamada**:
   - Preferir `call.cost` (número que a Vapi já expõe como total cobrado da chamada). Cair para `costBreakdown.total` quando `cost` ausente. Só como último recurso somar todas as chaves numéricas do `costBreakdown` (não apenas 4).
2. Trocar média simples por **média ponderada por duração**:
   - Acumular `totalCost` e `totalMinutes` entre todas as chamadas válidas; `avgCostPerMin = totalCost / totalMinutes`.
3. Manter o breakdown por componente (STT/LLM/TTS/Vapi) também **ponderado** (Σstt / Σminutos, idem llm/tts/vapi) para o tooltip continuar coerente.
4. Reduzir filtro mínimo de duração para `durSec > 0` (evita divisão por zero, mas não descarta chamadas curtas que o painel considera).

Nenhuma mudança na UI — o card em `src/routes/_authenticated/assistants.$id.tsx` continua lendo `avgCostPerMin` e `breakdown` como hoje.

## Como validar
Após aplicar, recarregar `/assistants/:id`. O badge "Custo real" deve subir para ~$0.08–0.084/min (mesma faixa do painel, dependendo do mix de transport/analysis das 38 chamadas). Latência não muda.
