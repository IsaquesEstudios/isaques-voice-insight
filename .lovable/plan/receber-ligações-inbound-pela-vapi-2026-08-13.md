# Receber ligações (inbound) pela Vapi

Hoje o painel usa os números só para ligações de saída e para vincular assistente. Falta expor e configurar o caminho de entrada: quando alguém liga para o seu DID, a Vapi atende com o assistente escolhido.

## O que muda

### 1. Telefonia: seção "Recebimento de ligações"
- Em cada número da tabela, além do assistente atual, um seletor claro de **Assistente de entrada** (quem atende quando ligam para esse número) com estado "Nenhum — chamadas recebidas serão recusadas".
- Badge por número: **Entrada ativa** / **Somente saída**, com base no que a Vapi retorna (assistente vinculado + tronco com entrada habilitada).
- Bloco de instruções copiável com os dados que a operadora precisa para apontar o tráfego de entrada para a Vapi (host SIP da Vapi `sip.vapi.ai`, o número em E.164 e o usuário do tronco), com botão de copiar.

### 2. Tronco SIP com entrada habilitada
- Hoje, se o host informado não for IPv4 numérico, a credencial é criada com `inboundEnabled: false` (só saída). Passa a existir um aviso explícito na UI quando isso acontecer, orientando a trocar o host pelo IP para liberar entrada.
- Botão "Habilitar entrada" que recria/atualiza a credencial do tronco na Vapi com o gateway em IP e entrada ligada, e revalida o número.

### 3. Números gratuitos da Vapi
- Para números provisionados na própria Vapi, receber já funciona assim que houver assistente vinculado; a UI passa a mostrar isso claramente (sem exigir tronco SIP).

### 4. Onboarding
- No passo do número, uma linha explicando que o mesmo número serve para sair e receber, e que receber exige assistente vinculado.

## Detalhes técnicos

- `src/lib/vapi.functions.ts`
  - `attachAssistantToNumber` já faz `PATCH /phone-number/:id { assistantId }` — é o mecanismo de inbound; reaproveitado.
  - Nova função `setInboundEnabled`: recria a credencial `byo-sip-trunk` com `gateways[0].inboundEnabled: true` (exige IP numérico) e faz `PATCH` do número para a credencial atualizada.
  - `listVapiPhoneNumbers` passa a devolver também `credentialId`, `status` e um flag `inboundReady` (assistente vinculado + credencial com entrada, ou provider `vapi`).
- `src/routes/_authenticated/telefonia.tsx`: nova coluna/badge, seletor de assistente de entrada, bloco de instruções para a operadora e botão "Habilitar entrada".
- Sem mudanças de schema.

## Fora do escopo
- Webhooks de eventos de chamada recebida e roteamento por horário/URA.
