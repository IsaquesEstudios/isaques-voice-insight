# Plano: corrigir autorização do dispatch LiveKit

## Objetivo
Eliminar o erro `401 permissions denied` ao enviar o agente para a sala de teste.

## Diagnóstico confirmado
- O backend chama corretamente `AgentDispatchService/CreateDispatch` depois de criar a sala.
- O JWT de serviço contém `roomAdmin: true`, mas não inclui `room: <nome-da-sala>` no grant `video`.
- A implementação oficial do LiveKit valida `CreateDispatch` com permissão administrativa vinculada à sala solicitada; por isso o token atual é rejeitado antes mesmo de verificar se o worker está online.

## Alteração
- Ajustar `src/lib/livekit.server.ts` para incluir o nome exato da sala no grant administrativo usado pelo dispatch.
- Manter as permissões já existentes para criação de sala e não alterar o token do participante do navegador.
- Preservar o fluxo atual de metadata e `LIVEKIT_AGENT_NAME`.

## Validação
- Confirmar que o projeto compila sem erros.
- Iniciar uma chamada de teste e verificar que `CreateDispatch` deixa de retornar 401.
- Confirmar no painel se o agente entra na sala; se o dispatch for aceito mas o worker estiver offline ou com nome diferente, manter o aviso específico de “aguardando agente”.

## Escopo
Somente a autorização do dispatch LiveKit será alterada; Vapi, campanhas, telefonia e demais fluxos permanecem intactos.
