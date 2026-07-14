## Objetivo
Simplificar o card "Contatos de teste" em `/telefonia`: remover o seletor "Número de origem" e deixar apenas a escolha da assistente + botão **Ligar**. O número de origem é escolhido automaticamente.

## Mudanças (arquivo único: `src/routes/_authenticated/telefonia.tsx`)

1. **Remover UI de seleção de origem**
   - Apagar o bloco `Label "Número de origem" + Select` dentro do map de `testContacts` (aprox. linhas 938–966).
   - Remover o estado `rowCallFrom` e o `setRowCallFrom` (ficam sem uso).

2. **Escolher o número de origem automaticamente**
   - No `testCallMutation.mutationFn`, substituir a leitura de `rowCallFrom[contact.id]` por uma seleção automática:
     - Preferir o primeiro número da lista `numbers` (Vapi phone numbers já conectados) que tenha uma assistente vinculada — ou simplesmente `numbers[0]?.phone_number`.
   - Se `numbers.length === 0`, rejeitar com toast: *"Conecte um número em 'Conectar Número' antes de testar a ligação."* (mantém orientação clara em vez de sumir com o erro).
   - O botão **Ligar** fica desabilitado quando: sem assistente selecionada, sem números disponíveis, Twilio não conectado, ou chamada em andamento.

3. **Ajustar o texto de ajuda do card**
   - Atualizar o subtítulo do card para deixar claro que a ligação parte automaticamente do primeiro número conectado.
   - Se `numbers.length === 0`, mostrar um `Alert` curto acima da lista: *"Nenhum número conectado à Vapi. Vá em 'Conectar Número' para poder disparar testes."*

## Fora de escopo
- Não alterar `vapi.functions.ts` nem `twilio.functions.ts`.
- Não mexer nos outros cards (Rotas ativas, Meus números, modal Conectar Número).
- Não alterar o fluxo de verificação de Caller IDs.

## Sobre "número padrão da Twilio"
A Vapi/Twilio não fornece um número global padrão — a ligação sai de um número que **você conectou** à Vapi. É por isso que o select aparecia vazio: se nenhum número foi importado para a Vapi ainda, não há origem para disparar. A tela vai passar a escolher sozinha o primeiro disponível, e se não houver nenhum, mostra o aviso pedindo para conectar um em "Conectar Número".
