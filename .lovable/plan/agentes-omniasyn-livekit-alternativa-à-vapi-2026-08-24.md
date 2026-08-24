# Agentes Omniasyn (LiveKit) — alternativa à Vapi

Criar uma seção própria de **agentes de voz via LiveKit** dentro da página Assistentes Virtuais, com destaque visual de marca (Omniasyn), cadastro de agentes salvo no banco e teste de chamada de voz direto no navegador.

## O que será construído

### 1. Dependências
- `bun add livekit-client @livekit/components-react jose`
- `jose` assina o token JWT no backend (compatível com o runtime serverless; evita o `livekit-server-sdk`).

### 2. Credenciais da plataforma (ação sua, na hora da implementação)
Como o LiveKit é único e seu, guardamos 3 secrets seguros (não ficam no código):
- `LIVEKIT_URL` (ex: `wss://seu-projeto.livekit.cloud`)
- `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET`

Você encontra esses valores no painel do LiveKit Cloud em **Settings → API Keys**. Vou solicitar via formulário seguro quando começarmos.

### 3. Banco de dados — tabela `livekit_agents`
Migração com: `id`, `user_id` (dono), `name`, `perfil`, `contexto` (prompt/instruções), `voz`, `metadata` (jsonb), timestamps. Com `GRANT`s e políticas RLS por `auth.uid()` — cada usuário só vê/edita os próprios agentes.

### 4. Backend — `src/lib/livekit.functions.ts`
Server functions autenticadas (`requireSupabaseAuth`), no padrão atual do projeto (nada de Edge Function):
- **CRUD**: `listLivekitAgents`, `createLivekitAgent`, `updateLivekitAgent`, `deleteLivekitAgent`.
- **`startLivekitCall({ agentId })`**: carrega o agente do banco, cria a sala no LiveKit via API REST (`CreateRoom`) com `metadata` contendo `{ perfil, nome, contexto }` (é isso que dispara seu agente por dispatch automático e entrega os dados dinâmicos a ele), gera o token JWT de acesso à sala (com a mesma metadata no participante, como redundância) e retorna `{ token, serverUrl, roomName }`. As secrets são lidas com `process.env` apenas dentro do handler — nunca expostas ao navegador.

### 5. Frontend
**`src/components/assistants/livekit-call-dialog.tsx`** (novo):
- Estados `isConnecting` (enquanto busca o token), `error` (traduzido para pt-BR via `translateError`) e `token`.
- Com token disponível: `<LiveKitRoom token serverUrl connect audio>` + `<RoomAudioRenderer />` (obrigatório para o áudio do agente tocar no navegador).
- Controles: indicador de conexão, mudo/desmudo do microfone, encerrar chamada (disconnect + limpeza de estado).
- Aviso de custo no início do teste, no mesmo espírito do teste Vapi.

**`src/routes/_authenticated/assistentes.tsx`** (edição):
- Nova seção abaixo dos assistentes Vapi: **"Agentes Omniasyn — LiveKit"** com identidade visual própria: badge "Omniasyn", borda/gradiente nas cores da marca (cyan `#00acdc` → verde `#2abb65`) para diferenciar claramente dos cards Vapi.
- Cards de agente (nome, perfil, voz) com ações: editar, excluir e **"Testar chamada"** (abre o dialog LiveKit).
- Dialog de criar/editar agente: nome, perfil, contexto/instruções, voz.
- Skeletons de carregamento no padrão existente da página; lista atualiza automaticamente após cada operação (invalidação do React Query).

## Fora de escopo
- O limite de 4 assistentes é só da Vapi — agentes LiveKit não entram nessa cota.
- Menu lateral não muda (a seção vive dentro de Assistentes Virtuais).
- O worker/agent do LiveKit (quem fala na sala) já existe no seu lado e usa dispatch automático — não vamos alterá-lo.

## Verificação
1. Criar um agente no painel e confirmar o registro no banco.
2. Clicar em "Testar chamada": token gerado, sala conectada, `RoomAudioRenderer` ativo e agente entrando na sala com a metadata correta (visível nos logs do seu worker LiveKit).
3. Editar/excluir agente e confirmar atualização instantânea da lista.
4. Testar erro (ex: secret inválida) e conferir mensagem em pt-BR.

## Detalhes técnicos
- Token JWT LiveKit: assinado com `jose` (HS256, API secret), grants `roomJoin` + `room`, `exp` curto (10 min), `metadata` do participante em JSON.
- CreateRoom: `POST {LIVEKIT_URL}/twirp/livekit.RoomService/CreateRoom` com JWT de serviço (`video: { roomCreate: true }`).
- `livekit-client` só é importado no dialog (componente client-only) — sem impacto no SSR.
- Erros de permissão/microfone traduzidos pelas regras existentes em `src/lib/error-messages.ts`.
