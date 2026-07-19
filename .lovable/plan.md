Vou corrigir o player de gravações mantendo a tela atual de Logs.

O que está acontecendo:
- Os áudios existem, porque você consegue ouvir no painel da Vapi.
- O erro atual não diz que o áudio não existe. Ele vem do nosso proxy: a URL da gravação está em um host `r2.cloudflarestorage.com`, e a validação atual só permite Vapi/Daily/Google/AWS.
- Como o navegador também pode bloquear o download direto por CORS, precisamos permitir esse host no proxy seguro.

Plano de implementação:
1. Atualizar `fetchRecordingAsDataUrl` em `src/lib/vapi.functions.ts`
   - Permitir URLs oficiais usadas pela Vapi em Cloudflare R2: `*.r2.cloudflarestorage.com`.
   - Manter a proteção contra URLs arbitrárias para evitar uso indevido do proxy.
   - Melhorar a mensagem de erro para ficar clara quando a gravação existir, mas o host ainda não estiver liberado.

2. Melhorar o `RecordingPlayer` em `src/routes/_authenticated/assistants.$id.tsx`
   - Continuar tentando carregar direto primeiro.
   - Se falhar por CORS, usar o proxy do servidor automaticamente.
   - Mostrar uma mensagem mais amigável: “A gravação existe, mas precisa ser carregada pelo servidor” apenas se ainda houver erro real.
   - Manter o link “Abrir/baixar áudio original”.

3. Verificar o resultado
   - Confirmar que o host R2 deixa de ser bloqueado.
   - Confirmar que o player recebe uma URL/data URL válida para o `<audio>` exibir duração e tocar.