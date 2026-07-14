## Diagnóstico

A lista "Contatos de teste" usa `useQuery({ queryKey: ["verified-caller-ids"] })` que herda o cache global longo (`staleTime` alto configurado para navegação instantânea). Como o Caller ID foi verificado **fora do app** (no Console Twilio), o React Query nunca é invalidado — ele continua servindo o snapshot vazio em cache. A chamada à Twilio (`GET /OutgoingCallerIds.json`) está correta e o mapeamento (`outgoing_caller_ids → { sid, phone_number, friendly_name }`) também.

## Correções (arquivo único: `src/routes/_authenticated/telefonia.tsx`)

1. **Forçar refetch ao entrar no card**  
   No `useQuery` do `testContactsQuery`, adicionar:
   - `staleTime: 0`
   - `refetchOnMount: "always"`
   - `refetchOnWindowFocus: true`  
   Isso garante que, sempre que a página `/telefonia` for aberta ou refocada, ele bate na Twilio novamente e pega o Caller ID recém-verificado.

2. **Botão "Atualizar" no header do card "Contatos de teste"**  
   Adicionar um `IconButton` (ícone `RefreshCw` do lucide) ao lado do botão "Novo contato" que chama `testContactsQuery.refetch()` com um spinner enquanto `isFetching`. Assim o usuário força a sincronização sem esperar remount.

3. **Feedback de estado vazio mais claro**  
   Se `data.length === 0` e o usuário está conectado ao Twilio, além do texto atual mostrar um aviso curto: *"Nenhum Caller ID verificado encontrado na sua conta Twilio. Verifique um número em Console → Phone Numbers → Verified Caller IDs e clique em Atualizar."*

Nenhuma mudança em `twilio.functions.ts` — a função server-side já está correta.

## Fora de escopo
- Não mexer no fluxo de criação (popup "Novo contato").
- Não alterar `twilio.functions.ts`.
- Não tocar em outros cards da página.