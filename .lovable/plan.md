# Somente Vapi: telefonia deixa de ser obrigatória

A partir de agora a única integração obrigatória é a Vapi. A operadora (Nvoip) some da plataforma como conceito: o usuário passa a ter duas formas de ter número:

1. Puxar números que já existem na conta Vapi dele (importar direto da Vapi).
2. Preencher os dados de um tronco SIP genérico aqui no painel — a plataforma cria a credencial SIP na Vapi e o número passa a funcionar.

## O que muda para o usuário

- **Cadastro**: apenas uma etapa — a chave da Vapi. Nada de telefonia no onboarding.
- **Banner de "cadastro incompleto"**: removido. Não existe mais estado pendente por causa de telefonia.
- **Página Telefonia**: some tudo que fala "Nvoip". Fica:
  - Bloco "Números da sua conta Vapi", com botão para sincronizar/importar.
  - Bloco "Conectar tronco SIP", com host, usuário, senha e um rótulo — genérico, serve para qualquer operadora (inclusive a Nvoip, digitando o host dela).
  - Saldo/DIDs da operadora deixam de ser exibidos (eram específicos da API Nvoip).
- **Configurações**: o card da operadora vira "Tronco SIP (opcional)", com o mesmo formulário genérico e opção de desconectar.
- Mensagens de erro deixam de citar a operadora; passam a falar em "tronco SIP".

## Detalhes técnicos

- `src/lib/nvoip.functions.ts` → substituído por `src/lib/sip.functions.ts` com apenas: `saveSipTrunk`, `getSipConnection`, `disconnectSipTrunk`, `registerSipNumber` (cadastro local do DID). Remover chamadas à API REST da Nvoip (`listNvoipNumbers`, `getNvoipBalance`, probe de Napikey/OAuth) — a plataforma não conversa mais com operadora nenhuma.
- Reaproveitar a tabela `user_nvoip_credentials` como armazenamento do tronco (sem migração destrutiva); colunas `api_key`/`client_id`/`client_secret` deixam de ser preenchidas. `sip_host` sem default de operadora.
- `src/lib/vapi.functions.ts`: renomear helpers `loadNvoipTrunk`/`ensureNvoipCredentialId`/`ensureNvoipSipCredential` para nomes neutros (`loadSipTrunk`/`ensureSipCredentialId`/`ensureSipCredential`); `provider` gravado nos números vira `"sip"` em vez de `"nvoip"`. Comportamento do BYO SIP Trunk na Vapi permanece igual.
- `getSetupStatus`: `telefonia` deixa de bloquear qualquer coisa; o gate em `src/routes/_authenticated/route.tsx` passa a exigir só `vapi`.
- `src/routes/_authenticated/onboarding.tsx`: passa a ter uma única etapa (Vapi) e redireciona ao painel assim que a chave é salva.
- Excluir `src/components/setup-banner.tsx` e seu uso no layout.
- `src/lib/error-messages.ts`, `numbers.functions.ts`, comentários e labels: trocar menções à operadora por "tronco SIP".
