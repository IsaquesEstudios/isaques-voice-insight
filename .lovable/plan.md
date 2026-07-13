
## O que muda

Substituir o fluxo atual (SMS OTP / salvar direto / importar) da seção **Contatos de teste** pelo mesmo mecanismo que o Twilio Console usa em "Verify your first Caller ID":

1. Você digita **nome + número (E.164)** e clica em "Iniciar verificação".
2. A Twilio liga imediatamente para esse número (via `POST /OutgoingCallerIds.json` na sua conta Twilio conectada) e devolve um código de 6 dígitos.
3. Mostramos o código em destaque no modal com a instrução: "Atenda a ligação e digite este código no teclado do telefone."
4. Enquanto o modal está aberto, fazemos polling do endpoint `/OutgoingCallerIds.json` a cada 3s.
5. Assim que o número aparecer lá (= Twilio confirmou), gravamos automaticamente em `user_test_contacts` como `verified: true` e fechamos o modal — o contato já aparece na lista pronto para "Ligar".

O restante da UI da seção (lista de contatos, seletor de número de origem, seletor de assistente, botão "Ligar") não é tocado.

## Escopo dos arquivos

Apenas **`src/routes/_authenticated/telefonia.tsx`** — nenhuma outra tela ou arquivo é alterado.

O backend não precisa de mudanças: `startCallerIdVerification`, `listVerifiedCallerIds` e `saveTestContact` já existem em `src/lib/twilio.functions.ts`.

## Detalhes técnicos

- **Imports**: adicionar `startCallerIdVerification, listVerifiedCallerIds` e remover `sendVerifyOtp, checkVerifyOtp, addVerifiedFromTwilio` (deixam de ser usados). `saveTestContact` fica.
- **Estado**: remover `otpStep`, `otpCode`, `trialBlocked`. Adicionar `verifyStep: { phoneE164; label; validationCode; sid? } | null`.
- **Mutations**: substituir `sendOtpMutation`, `confirmOtpMutation`, `trustFromTwilioMutation` por uma única `startVerifyMutation` que chama `startCallerIdVerification`. `saveContactMutation` permanece — passa a ser disparada automaticamente pelo efeito de polling.
- **Polling**: `useQuery(["verified-caller-ids"], listVerifiedCallerIds, { enabled: !!verifyStep, refetchInterval: 3000 })` + `useEffect` que, quando `phoneE164` aparece na lista, chama `saveContactMutation` e limpa `verifyStep`.
- **Erros da Twilio**:
  - `10002` (conta trial não permite verificação por chamada): mostrar alerta explicando o motivo — sem tentar SMS (contas trial também bloqueiam SMS para números não verificados).
  - Outros: toast com a mensagem retornada.
- **Modal**: dois estados internos —
  - Sem `verifyStep`: form (identificação + número) + botão "Iniciar verificação por chamada".
  - Com `verifyStep`: bloco grande com o `validationCode` em fonte mono + texto "A Twilio está ligando para {phoneE164}. Atenda e digite este código no teclado." + botão "Cancelar" e um spinner "Aguardando confirmação…".
- **Remover** o segundo `<Dialog>` de "Digite o código recebido por SMS" (linhas ~1146–1211).

## Observações

- O fluxo é idêntico ao do console Twilio — funciona para qualquer conta que consiga usar "Verify a Caller ID" no console. Contas trial da Twilio geralmente **bloqueiam** esse endpoint via API (erro 10002); nesse caso o alerta orienta a verificar pelo próprio console (a lista continua sendo lida da mesma API, então o número aparecerá aqui automaticamente após a verificação manual).
- Nada muda no comportamento do botão "Ligar" nem nos seletores de origem/assistente.
