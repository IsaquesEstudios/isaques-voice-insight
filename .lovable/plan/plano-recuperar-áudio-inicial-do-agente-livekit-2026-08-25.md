# Plano: recuperar áudio inicial do agente LiveKit

## Objetivo
Fazer o teste do agente LiveKit voltar a falar nos primeiros segundos e evitar depender de ajustes antigos que pioraram o fluxo.

## O que foi confirmado no app
- O frontend já conecta ao LiveKit e publica o microfone: o print mostra `publishing track`, `signal connected` e `connected to Livekit Server`.
- O backend atual cria a sala explicitamente em `startLivekitCall` e envia `metadata` no token do participante.
- O diálogo atual cria uma instância manual de `Room`, chama `startAudio()` no clique e monta `RoomAudioRenderer`, então a falha mais provável agora está no despacho/entrada do worker ou no áudio remoto não chegando ao navegador.

## Alteração proposta
1. **Voltar para um fluxo simples e compatível**
   - Manter a criação explícita da sala no backend.
   - Não usar mais configuração experimental de despacho via `roomConfig` no JWT.
   - Garantir que o token do navegador continue levando o JSON que seu Python lê em `user_participant.metadata`.

2. **Adicionar despacho explícito do agente no backend**
   - Depois de criar a sala, chamar a API de dispatch do LiveKit para enviar o worker para aquela sala.
   - Enviar a mesma metadata no dispatch e no participante, para seu Python conseguir ler `perfil`, `nome` e `contexto`.
   - Tratar erro de dispatch com mensagem clara no painel, em vez de conectar silenciosamente sem agente.

3. **Ajustar o frontend para diagnosticar áudio remoto**
   - Manter o `RoomAudioRenderer`.
   - Mostrar um aviso se conectar à sala, mas nenhum participante/agente remoto entrar em alguns segundos.
   - Mostrar um aviso separado se o navegador bloquear reprodução de áudio.

4. **Alinhar com seu código Python**
   - O app continuará enviando a metadata no participante, como seu worker lê hoje.
   - Recomendar como complemento no worker: também ler `ctx.room.metadata` como fallback e manter os logs `user_input_transcribed` e `error`.
   - O código Python tem pontos externos ao app que ainda podem impedir fala/escuta, como credenciais de Cartesia/Deepgram/Google e autorizações do LiveKit, mas o painel passará a mostrar melhor quando o agente não entrar.

## Arquivos que serão alterados
- `src/lib/livekit.server.ts`
  - Adicionar helper para despacho explícito do agente LiveKit.
  - Manter helpers de sala/token existentes.

- `src/lib/livekit.functions.ts`
  - Criar sala, despachar agente e só depois retornar token ao navegador.
  - Propagar erros do LiveKit em português claro.

- `src/components/assistants/livekit-call-dialog.tsx`
  - Adicionar estado de “aguardando agente”.
  - Detectar participante remoto/faixa de áudio remota.
  - Exibir alerta quando o navegador conectou, mas o agente não entrou/falou.

## Fora do escopo
- Não alterar Vapi, campanhas, dashboard, telefonia ou outros fluxos.
- Não reescrever seu worker Python dentro do app.
- Não trocar provedores de STT/TTS/LLM.

## Validação
- Conferir que o build continua OK.
- Abrir o teste de ligação e verificar pelo console/estado da sala se:
  - o navegador conecta;
  - o microfone é publicado;
  - o agente entra como participante remoto;
  - o áudio remoto fica disponível ou aparece um erro claro dizendo onde parou.
