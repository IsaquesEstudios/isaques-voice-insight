# Campanha: liga, mas a IA não fala

A ligação de teste com a mesma assistente e o mesmo número funciona; só a campanha fica em silêncio total e cai em ~11s. Isso aponta para algo específico do disparo por campanha — mas ainda não está confirmado qual. O primeiro passo é ler o motivo real do encerramento na própria chamada, e só depois aplicar a correção.

## Passo 1 — Diagnóstico (obrigatório antes de corrigir)

Buscar na Vapi as chamadas geradas pela campanha e mostrar, para cada uma:

- `status` e `endedReason` (ex.: `silence-timeout-reached`, `pipeline-error-...`, `customer-did-not-speak`, `assistant-did-not-receive-customer-audio`)
- se existe transcrição/mensagens (se a assistente chegou a gerar a primeira fala)
- qual `assistantId` e `phoneNumberId` a chamada realmente usou

Isso responde de forma definitiva se o problema é (a) a assistente não recebendo/enviando áudio pelo tronco SIP, ou (b) a assistente não sendo aplicada à chamada da campanha.

## Passo 2 — Correção conforme o diagnóstico

- Se o motivo indicar falta de áudio do cliente (silêncio/timeout) → ajustar o plano de início da campanha: enviar explicitamente `firstMessage` + `firstMessageMode: assistant-speaks-first` e desativar a espera por fala do cliente no disparo em massa, além de revisar detecção de secretária eletrônica (voicemail detection), que costuma segurar a fala inicial em campanhas.
- Se a chamada vier sem assistente aplicada → passar a assistente também no corpo da campanha (assistente + overrides), em vez de depender só do `assistantId` no topo.
- Se for erro de mídia/tronco → ajustar como o número de origem é vinculado no disparo da campanha e reportar o erro traduzido na tela.

Em todos os casos, o motivo real de encerramento passa a aparecer no painel de campanhas (coluna/tooltip por campanha), para não precisar adivinhar da próxima vez.

## Detalhes técnicos

- `src/lib/vapi.functions.ts`: nova server fn `listCampaignCalls` (GET `/call?campaignId=...`) retornando `status`, `endedReason`, duração e se houve mensagens da assistente; ajuste no corpo do `POST /campaign` conforme o achado (bloco de primeira fala / voicemail detection).
- `src/routes/_authenticated/campanhas.tsx`: exibir o motivo de encerramento das últimas chamadas de cada campanha, com texto traduzido via `translateError`.

## Observação

Não vou afirmar a causa antes de ler os registros: silêncio + queda em ~11s tem mais de uma explicação possível, e mudar a configuração no chute pode mascarar o problema real.
