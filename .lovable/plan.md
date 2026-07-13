## Objetivo

Mostrar, ao lado dos selects de **Modelo** e **Voz** na aba Assistente (`/assistants/:id`), uma previsão de custo por minuto baseada na tabela pública de preços da Vapi, atualizando em tempo real conforme o usuário troca a IA. O total combinado (LLM + TTS + STT + Vapi platform fee) aparece como um pequeno resumo abaixo, ajudando a escolher a opção mais econômica.

Escopo restrito à tela de detalhes do assistente — nenhum outro arquivo é tocado.

## O que será feito

1. **Novo arquivo `src/lib/vapi-pricing.ts`** (client-side, estático)
   - Tabela `MODEL_PRICING` com custo em USD/min por `provider/model` para os modelos já listados em `MODEL_OPTIONS` (OpenAI gpt-4o, gpt-4o-mini, gpt-3.5-turbo; Anthropic claude-3.5-sonnet/haiku; Google gemini; Groq).
   - Tabela `VOICE_PRICING` com custo USD/min por `provider/voiceId` (11labs, PlayHT, Deepgram, etc.).
   - Constantes fixas: `STT_COST_PER_MIN` (Deepgram Nova padrão Vapi) e `VAPI_PLATFORM_FEE_PER_MIN` (0.05).
   - Helpers `getModelCost(provider, model)`, `getVoiceCost(provider, voiceId)`, `formatUSD(n)`.
   - Valores baseados na página pública de pricing da Vapi; comentário no topo com data e link para revisão.

2. **Novo componente `src/components/assistants/cost-hint.tsx`**
   - Chip inline compacto: ícone + `~ $0.XX/min` + tooltip explicando a origem do valor.
   - Props: `label` (ex: "Modelo"), `costPerMin`, `breakdown?` (para o total).
   - Estilo alinhado ao design atual (glass, muted-foreground, `text-xs`).

3. **Edição em `src/routes/_authenticated/assistants.$id.tsx`** (única alteração de tela)
   - Importa os helpers e o `CostHint`.
   - Abaixo do `Select` de **Modelo** (dentro da aba Assistente) renderiza `<CostHint costPerMin={getModelCost(modelProvider, model)} />`.
   - Abaixo do `Select` de **Voz** renderiza `<CostHint costPerMin={getVoiceCost(voiceProvider, voiceId)} />`.
   - Ao final do bloco de configuração (ou logo abaixo dos dois selects), um resumo pequeno:
     `Custo estimado total: ~$X.XX/min` com breakdown em tooltip (LLM + TTS + STT + Vapi).
   - Se o par provider/model não estiver na tabela, mostra `—` e tooltip "Preço não catalogado".

## Detalhes técnicos

- 100% frontend/presentation, sem alterações no server ou em `vapi.functions.ts`.
- Nenhuma nova rota, migration ou secret.
- Nenhum request adicional — cálculo local e instantâneo.
- Formato do valor: USD com 3 casas quando < $0.10, senão 2 casas (`$0.006/min`, `$0.18/min`).
- Comentário no `vapi-pricing.ts` avisa que os valores devem ser revisados periodicamente contra a página oficial da Vapi.

## Fora do escopo (não faremos agora)

- Buscar custo real das últimas chamadas via `/call` (fica para uma segunda etapa se você quiser).
- Card de custo na lista de assistentes ou página dedicada de comparação.
- Conversão USD→BRL.
