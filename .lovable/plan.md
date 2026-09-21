# Player de áudio nas conversas do WhatsApp

## O que será feito

- Substituir o controle genérico do navegador por um player inspirado no WhatsApp e alinhado às cores da Omniasyn.
- Exibir botão de reproduzir/pausar, forma de onda, tempo atual e duração do áudio.
- Ocultar o texto técnico `[audio]` quando a mensagem tiver o arquivo de áudio disponível.
- Mostrar estados claros de carregamento e indisponibilidade quando o arquivo ainda não puder ser baixado.

## Detalhes técnicos

- A alteração ficará somente na apresentação da conversa em `src/routes/_authenticated/whatsapp.tsx`.
- O download autenticado da mídia pela API oficial da Meta será preservado.
- O player usará o elemento de áudio nativo internamente, com controles próprios e acessíveis.
