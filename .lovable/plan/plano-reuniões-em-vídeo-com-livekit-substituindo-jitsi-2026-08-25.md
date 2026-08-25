# Plano: Reuniões em vídeo com LiveKit (substituindo Jitsi)

## Objetivo
Trocar o motor da página **Reunião em vídeo** de Jitsi para LiveKit, usando a infraestrutura já existente (`livekit.server.ts`, worker Python rodando). A IA não entra automaticamente: um botão "Chamar IA" adiciona o agente à sala quando o usuário quiser. Convidados externos entram por link público digitando apenas o nome.

## Decisões confirmadas
- **Convidados:** usuário logado entra pelo painel; convidados externos entram por link público (`/reuniao/<codigo>`) informando o nome.
- **IA na reunião:** sob demanda, via botão "Chamar IA" dentro da sala.

## Alterações

### 1. Backend — `src/lib/livekit.functions.ts` (wrapper fino) + `livekit.server.ts`
- **`startLivekitMeeting`** (autenticada): valida nome da reunião e nome do participante, gera sala `reuniao-<slug>-<rand>`, cria a sala via `CreateRoom` com metadata `{ "tipo": "reuniao" }` e devolve `{ token, serverUrl, roomName }`. Token com TTL de 4h (reuniões duram mais que chamadas de teste).
- **`joinLivekitMeeting`** (autenticada): gera token de participante para uma sala `reuniao-*` existente (fluxo "entrar com código").
- **`joinLivekitMeetingAsGuest`** (pública, sem auth): valida que o código segue o padrão `reuniao-*`, confirma via API do LiveKit que a sala existe e está ativa, e emite token de convidado com o nome informado. Não expõe dados além do necessário para entrar na sala.
- **`callLivekitMeetingAgent`** (autenticada): dispara o agente para a sala via `CreateDispatch` com metadata `{ "tipo": "reuniao", "acao": "chamar_ia" }`. Se `LIVEKIT_AGENT_NAME` estiver configurado, usa dispatch nomeado; senão, dispatch sem nome (qualquer worker disponível atende).
- A criação da sala **não** acopla a IA: o worker Python deve ignorar o dispatch automático de salas `reuniao-*` e só entrar ao receber o dispatch com `acao: "chamar_ia"` (ajuste do lado do seu worker; o painel já envia o sinal correto).

### 2. Página de reuniões — `src/routes/_authenticated/reunioes.tsx` (reescrita)
- Remove todo o código Jitsi (script `external_api.js`, `JitsiMeetExternalAPI`).
- Mantém o visual atual: card "Criar reunião" (nome da reunião + seu nome) e o cabeçalho com código da reunião.
- Adiciona opção **"Entrar com código"** no card inicial (colar código de uma sala existente).
- Sala ativa renderiza `<LiveKitRoom audio video>` + `<VideoConference />` (grade de vídeo, controles de mic/câmera/tela prontos).
- Barra de ações da sala: **Copiar código**, **Copiar link** (link público do app), **Chamar IA** (com estado "IA a caminho…" e confirmação quando o agente entrar), **Sair**.
- Erros traduzidos em pt-BR via `translateError` (microfone/câmera bloqueados, sala inexistente etc.).

### 3. Rota pública de convidado — `src/routes/reuniao.$code.tsx` (nova)
- Página pública `/reuniao/<codigo>`: convidado digita o nome, o backend emite o token e ele entra na mesma sala com `<VideoConference />`.
- Tela de "sala não encontrada ou encerrada" quando o código é inválido.
- `head()` próprio (título/descrição "Reunião Omniasyn"), sem indexação privada.
- Também terá o botão **Chamar IA** disponível (mesma função pública de dispatch, validando padrão da sala).

### 4. Dependência e estilos
- `bun add @livekit/components-styles` (tema visual do `VideoConference`), importado apenas nos componentes de reunião.
- Sala usa o tema escuro nativo do LiveKit (`data-lk-theme="default"`), que combina com o dark mode Omniasyn.

## Fora do escopo
- Chamadas de teste com agentes (`LivekitCallDialog`) continuam iguais.
- Ajuste do worker Python (aceitar/ignorar dispatch conforme metadata) fica do seu lado — o painel já envia `tipo`/`acao` na metadata.

## Validação
- Build sem erros.
- Criar reunião no preview: sala abre com vídeo/áudio locais funcionando.
- Abrir o link público em aba anônima: convidado entra na mesma sala digitando só o nome.
- Clicar "Chamar IA": dispatch aceito (sem 401) e agente entra na sala quando o worker estiver configurado para `reuniao-*`.
