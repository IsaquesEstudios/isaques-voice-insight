## Objetivo
Adicionar, dentro do popup "Novo contato de teste" em `/telefonia`, o fluxo oficial da Twilio de **Verified Caller IDs** — a única forma de liberar contas trial a receberem ligações da Vapi/Twilio no número informado.

## Como funciona (fluxo Twilio nativo)
1. Usuário digita Identificação + Número de destino no popup.
2. Clica em **"Verificar número (ligação da Twilio)"**.
3. Backend chama `POST /OutgoingCallerIds.json` na Twilio → a Twilio devolve um `validation_code` de 6 dígitos e liga imediatamente para o número.
4. UI mostra o código de 6 dígitos na tela + instrução: *"A Twilio está ligando para o seu celular. Atenda e digite este código no teclado."*
5. Frontend faz polling em `GET /OutgoingCallerIds.json?PhoneNumber=...` a cada 3s (timeout 2 min). Assim que o número aparece na lista, está verificado.
6. Salva o contato em `user_test_contacts` com `verified = true` e fecha o modal.
7. A partir daí, o card **Teste de Voz por Telefone** (que já existe no popup) funciona — a Vapi consegue ligar via Twilio para esse número.

## Alterações

### `src/lib/twilio.functions.ts`
- `startCallerIdVerification({ phoneNumber, friendlyName })` → `POST /OutgoingCallerIds.json` com `PhoneNumber` e `FriendlyName`. Retorna `{ validationCode, callSid }`.
- `listVerifiedCallerIds({ phoneNumber? })` → `GET /OutgoingCallerIds.json` (filtrando por `PhoneNumber` quando fornecido). Retorna array de `{ phoneNumber, friendlyName, sid }`.
- Manter helpers SMS existentes intocados (usuário pode voltar a usá-los depois), mas eles não serão chamados por este fluxo.

### `src/routes/_authenticated/telefonia.tsx` (popup "Novo contato de teste")
- Remover UI residual de SMS/OTP.
- Novo layout do modal em 2 etapas:
  - **Etapa 1** — form: Identificação, Número (E.164), botão **"Verificar número (ligação da Twilio)"**.
  - **Etapa 2** — tela de verificação:
    - Exibe o código de 6 dígitos em destaque (badge grande, monospace).
    - Texto: "A Twilio está ligando para `+55…`. Atenda e digite este código no teclado do celular."
    - Indicador de polling ("Aguardando verificação…") + botão "Cancelar" e "Reenviar chamada".
    - Ao detectar verificação bem-sucedida: toast verde, `saveTestContact({ phoneNumber, label, verified: true })`, `refetch` da lista, fecha modal.
    - Timeout 2 min → toast informativo e botão "Tentar novamente".
- Manter o card `VoiceCallTestCard` que já existe no popup **fora** deste fluxo — ele passa a estar disponível na lista principal ou embaixo, após o contato ser criado. (Não removemos nada dele.)

### Tratamento de erros específicos da Twilio
- `21450` (número inválido) → "Número inválido. Use formato E.164 (+55…)".
- `21611` / trial restrictions em `OutgoingCallerIds` → mensagem exata da Twilio no toast.
- Qualquer outro erro → `Erro Twilio: ${message}`.

## Fora de escopo
- Não mexer no `VoiceCallTestCard`.
- Não alterar tabelas do Supabase.
- Não tocar em rotas fora de `/telefonia` nem em `twilio.functions.ts` além dos dois helpers listados.