# Campanha: o telefone toca, mas a Vapi diz "não conectou"

Não é contradição. Na ligação existem duas pontas:

1. A Vapi manda a chamada para o tronco SIP da operadora → a operadora toca o seu celular (por isso você recebe a ligação).
2. Quando você atende, a operadora precisa devolver o "atendeu" para a Vapi e abrir o canal de áudio (RTP) de volta.

O erro `call.in-progress.error-sip-outbound-call-failed-to-connect` acontece na etapa 2: o áudio/confirmação nunca voltou para a Vapi. Do seu lado o telefone toca e você atende; do lado da Vapi a chamada nunca "conectou", então a assistente nunca começa a falar e a sessão cai em ~11s. É o sintoma clássico de retorno de mídia bloqueado no tronco (NAT/IP não liberado, codec incompatível, ou a chamada saindo por uma rota diferente da usada no teste manual).

## O que ainda não está confirmado

O teste direto usa exatamente o mesmo payload da campanha (`assistantId` + `phoneNumberId` + `customer.number`), então a diferença não está no formato da requisição. Falta confirmar se as ligações da campanha estão realmente saindo pelo mesmo número/tronco do teste que funcionou.

## Passo 1 — Comparar campanha x teste (antes de mudar qualquer configuração)

Ampliar o Diagnóstico para mostrar, por ligação:

- qual `phoneNumberId` / número de origem a ligação usou de fato
- o número de destino exatamente como foi enviado
- `endedReason` completo, horários de início/fim e duração
- se a chamada chegou a ter `startedAt` (ou seja, se a Vapi considerou atendida)

E, ao lado, os mesmos campos da última ligação de teste bem-sucedida, para comparação direta na mesma tela.

Se os dois usarem o mesmo número de origem e só a campanha falhar, o problema é de rota/concorrência no tronco; se o número de origem for diferente, a correção é forçar a campanha a usar o mesmo número (e a mesma credencial SIP) do teste.

## Passo 2 — Correção conforme o resultado

- Número de origem diferente → vincular a campanha ao mesmo `phoneNumberId` validado e ressincronizar a credencial SIP antes do disparo.
- Mesmo número, só campanha falha → reduzir a concorrência do disparo (chamadas simultâneas) e reportar na tela quando o tronco recusar por canais/limite; o retorno de mídia precisa ser liberado no lado da operadora e o painel passa a exibir essa instrução traduzida.
- Em todos os casos: mensagem clara em pt-BR no diagnóstico explicando "tocou mas não conectou" em vez do código cru da Vapi.

## Detalhes técnicos

- `src/lib/vapi.functions.ts`: em `listCampaignCalls`, incluir `phoneNumberId`, `customer.number`, `startedAt`/`endedAt` e `endedReason` bruto no retorno; nova consulta da última chamada de teste da assistente para comparação.
- `src/routes/_authenticated/campanhas.tsx`: colunas de origem/destino/horários no diálogo de Diagnóstico e bloco comparativo "teste x campanha", com textos traduzidos por `translateError`/`ENDED_REASON_LABEL`.
