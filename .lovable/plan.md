## Objetivo
Adicionar um botão **"Testar no navegador"** na página de detalhe da assistente (`/assistants/:id`) que abre uma chamada de voz Web via SDK oficial da Vapi (`@vapi-ai/web`), permitindo que **qualquer usuário logado** teste sua própria IA falando pelo microfone do navegador — sem depender de Twilio, número comprado ou Caller ID verificado.

## Como isso funciona pra múltiplos usuários
- A **Vapi Public Key** é segura para uso no navegador (é isso que a própria Vapi documenta para o SDK Web). Não expõe dados de conta.
- O isolamento por usuário já existe: cada assistente pertence ao usuário logado via `user_assistants`. A página `/assistants/:id` só carrega assistentes do usuário atual, então o botão só aparece pra assistentes que ele possui. Todo usuário pode usar o mesmo botão pra testar as próprias assistentes.

## Mudanças

### 1. Secret
- Adicionar `VAPI_PUBLIC_KEY` via `add_secret` (usuário cola o valor de Vapi Dashboard → Settings → API Keys → Public Key).
- Expor a chave ao browser via server function pública (não como `VITE_*`, pra evitar hardcode no bundle): `getVapiPublicKey()` em `src/lib/vapi.functions.ts` — retorna `process.env.VAPI_PUBLIC_KEY` sem autenticação obrigatória. É seguro porque a chave já foi projetada para uso client-side.

### 2. Dependência
- `bun add @vapi-ai/web` (SDK oficial de Web Call).

### 3. Componente novo
- `src/components/assistants/web-call-dialog.tsx`:
  - Props: `assistantId: string`, `assistantName: string`, controlled `open/onOpenChange`.
  - Estados: `idle → connecting → in_call → ended | error`.
  - Ao abrir, busca a public key via `useServerFn(getVapiPublicKey)` (com cache pelo React Query — `queryKey: ['vapi-public-key']`, `staleTime: Infinity`).
  - Instancia `new Vapi(publicKey)` e chama `vapi.start(assistantId)`.
  - Eventos escutados: `call-start`, `call-end`, `speech-start`, `speech-end`, `message` (para transcript), `error`.
  - UI: status ao vivo (Conectando/Em ligação/Encerrada), indicador de quem está falando (usuário/IA), transcript rolável em tempo real, botões **Mutar**, **Encerrar**.
  - Solicita permissão de microfone via `getUserMedia({ audio: true })` no start; mostra erro amigável se negado.
  - Ao fechar o dialog: `vapi.stop()` + cleanup dos listeners.

### 4. Integração na página de detalhe
- Em `src/routes/assistants.$id.tsx` (ou `src/routes/_authenticated/assistants.$id.tsx`, conforme rota atual), adicionar botão **"Testar no navegador"** com ícone `Mic` ao lado dos botões existentes no header da página.
- Botão controla o `open` do `WebCallDialog`.
- Nenhuma mudança em outras páginas (lista de assistentes, telefonia, etc.).

## Segurança / limites
- A Public Key da Vapi é feita para browser — mesma classe de risco de uma publishable key. Não expõe dados nem permite gerenciar recursos.
- Rate limiting: a Vapi já aplica limites por assistente na conta; não vamos adicionar limite extra sem o usuário pedir.
- Cada usuário só vê e testa suas próprias assistentes (garantido pelo `user_assistants` já existente na rota de detalhe).

## Fora de escopo
- Não mexer em `/telefonia`, `/assistentes` (lista), nem no fluxo de Caller IDs.
- Não alterar `vapi.functions.ts` além de adicionar a função `getVapiPublicKey`.
- Não trocar o SDK por WebRTC manual nem gerar `webCallUrl` via API (usuário optou pelo SDK com public key).
