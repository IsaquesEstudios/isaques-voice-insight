## Diagnóstico: onde a Twilio está hoje

A Twilio está espalhada por 7 arquivos (~350 referências):

| Arquivo | Papel |
|---|---|
| `src/lib/twilio.functions.ts` (1.064 linhas) | 25 server functions: credenciais, busca/compra de DID, listar números, trunks, liberar número, endereços, bundles regulatórios, Verify (OTP), contatos de teste, caller IDs verificados, saldo |
| `src/routes/_authenticated/telefonia.tsx` (1.976 linhas) | Toda a UI: modal comprar número, BYOC, contatos de teste, chamada rápida |
| `src/routes/_authenticated/configuracoes.tsx` | Card de conexão + saldo Twilio |
| `src/routes/_authenticated/onboarding.tsx` | Etapa 2 do onboarding (Account SID + Auth Token) |
| `src/lib/vapi.functions.ts` | Importa número na Vapi com `provider: "twilio"` + SID/Token; resync de credenciais; `getSetupStatus` |
| `src/routes/_authenticated/route.tsx` | Gate de onboarding exige `twilio: true` |
| Banco | Tabela `user_twilio_credentials` (SID/token por usuário), `user_phone_numbers.provider = 'twilio'`, `twilio_sid` |

## O ponto crítico: a Vapi não tem provider "nvoip"

A Vapi só aceita nativamente Twilio, Vonage, Telnyx e números próprios dela. Para usar a Nvoip é obrigatório o caminho **BYO SIP Trunk**:

1. Criar na Vapi uma credencial `byo-sip-trunk` com o gateway SIP da Nvoip (host, usuário, senha).
2. Criar o número com `provider: "byo-phone-number"`, apontando para essa credencial.
3. **Entrada (inbound):** o DID da Nvoip precisa ser roteado no painel/API da Nvoip para o SIP URI da Vapi (`sip.vapi.ai`) ou para o trunk registrado.
4. **Saída (outbound):** a Vapi disca via o trunk da Nvoip.

Isso muda o modelo mental: hoje a plataforma "importa um número Twilio"; com a Nvoip ela passa a "registrar um tronco SIP e associar DIDs a ele".

## O que a Nvoip oferece (API `https://api.nvoip.com.br/v2`, auth OAuth2 Bearer ou `Napikey`)

Cobre: autenticação, chamadas, SMS, WhatsApp, contas SIP/ramais, provisionamento de trunk. **Precisa ser confirmado com o suporte/conta antes de codificar:**
- existe endpoint para **buscar e comprar DIDs** por DDD via API? (se não, a compra vira processo manual no painel e nosso app só cadastra o número)
- a Nvoip permite **rotear um DID para um SIP URI externo** (Vapi) ou exige registro SIP do lado deles?
- existe endpoint de **saldo/créditos** (para substituir o card de saldo Twilio)?
- existe **verificação de caller ID / OTP** equivalente ao Twilio Verify?

## Plano de migração (em fases)

**Fase 1 — Camada de credenciais**
- Nova tabela `user_nvoip_credentials` (api key / client id+secret, host SIP, usuário e senha do trunk) com RLS por usuário + GRANTs.
- Novo `src/lib/nvoip.functions.ts` espelhando a interface pública do `twilio.functions.ts` (mesmos nomes de retorno) para minimizar mudanças na UI.
- `getSetupStatus` passa a checar `nvoip` no lugar de `twilio`; gate em `_authenticated/route.tsx` acompanha.

**Fase 2 — Ponte com a Vapi**
- Nova função `ensureNvoipSipCredential`: cria/atualiza a credencial `byo-sip-trunk` na Vapi.
- `attachAssistantToNumber` e `resyncVapiNumberCredentials` ganham o caminho `byo-phone-number` (mantendo o caminho Twilio enquanto houver números legados).
- `provider` em `user_phone_numbers` passa a aceitar `'nvoip'`.

**Fase 3 — UI**
- Onboarding: etapa 2 vira "Nvoip" (API key + dados do trunk), com o passo a passo de onde achar no painel.
- Telefonia: modal de aquisição vira busca de DID Nvoip (ou cadastro manual, conforme a resposta da API); BYOC/SIP simplificado; contatos de teste desacoplados do Twilio Verify (verificação por chamada da própria Nvoip ou lista simples).
- Configurações + sidebar: card de saldo Nvoip (ou remoção do card se não houver endpoint).

**Fase 4 — Convivência e limpeza**
- Manter Twilio funcionando em paralelo por um período (usuários com números já importados), com o provedor escolhido por usuário.
- Depois de migrados todos, remover `twilio.functions.ts` e as referências.

## Recomendação

Antes de escrever código, precisamos das respostas das 4 perguntas acima e de uma conta Nvoip de teste com um DID. Se a Nvoip não permitir rotear DID para SIP externo, a substituição não é viável com a Vapi e o caminho seria manter a Twilio como transporte.

## Detalhes técnicos

- Vapi: `POST /credential` (`provider: "byo-sip-trunk"`, `gateways: [{ ip: "sip.nvoip.com.br" }]`, `outboundAuthenticationPlan` com usuário/senha) e `POST /phone-number` (`provider: "byo-phone-number"`, `credentialId`, `number`, `numberE164CheckEnabled: false`).
- Segredos: as credenciais Nvoip são por usuário (mesmo padrão atual), gravadas na tabela via server function autenticada — nunca em `.env`.
- Nenhuma chamada à Nvoip pode sair do browser: tudo em `createServerFn` com `requireSupabaseAuth`.
