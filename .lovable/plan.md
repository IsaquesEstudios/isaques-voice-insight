## Por que hoje não transfere "automaticamente"

Na Vapi o `transferCall` é uma **ferramenta que a IA decide chamar**. Não existe transferência automática por si só — ela acontece quando:

1. o destino tem uma **condição/descrição** ("quando o cliente pedir para falar com um humano"), e
2. o **prompt do assistente** manda usar a ferramenta nessa situação.

Hoje o formulário salva apenas `type` + `number`/`sipUri` no destino, e nada é escrito no prompt. Por isso a IA quase nunca dispara a transferência.

## O que vou construir

### 1. Campos por destino (aba Tools → Transfer Call)
Para cada destino adicionado:
- **Quando transferir** (`description`) — a condição em linguagem natural que a IA avalia. Ex.: "quando o cliente pedir atendimento humano ou falar de cancelamento".
- **Mensagem antes de transferir** (`message`) — o que a IA fala antes de passar a ligação. Ex.: "Só um momento, vou te transferir para um especialista."
- **Modo de transferência** (`transferPlan.mode`) — dropdown:
  - `blind-transfer` (padrão, passa a ligação direto)
  - `blind-transfer-add-summary-to-sip-header`
  - `warm-transfer-say-message` (fala uma mensagem para quem recebe)
  - `warm-transfer-say-summary` (resume a conversa para quem recebe)
  - `warm-transfer-wait-for-operator-to-speak-first-and-then-say-message`
  - com o campo extra de mensagem/summary quando o modo exigir.

### 2. Passagem correta para a Vapi
Ajustar o sanitizador em `src/lib/vapi.functions.ts` para preservar `description`, `message`, `transferPlan` e `number`/`sipUri` (+ `numberE164CheckEnabled`) dentro de cada item de `destinations`, em vez de repassar o array cru.

### 3. Ajuda no prompt (a peça que faz "acontecer sozinho")
No card do transferCall, um botão **"Inserir regra no prompt"** que adiciona ao System Prompt do assistente um bloco gerado a partir dos destinos, por exemplo:

```text
## Transferência
Se o cliente pedir para falar com um humano ou mencionar cancelamento,
chame a ferramenta transferCall com o destino +55 11 99999-9999.
Nunca prometa transferir sem chamar a ferramenta.
```

Isso é salvo junto no `model.messages[0].content` via o fluxo de salvar que já existe.

### 4. Aviso na UI
Se um destino não tiver "Quando transferir" preenchido, mostrar um aviso discreto: "sem condição, a IA raramente vai transferir".

## Detalhes técnicos

- `src/routes/_authenticated/assistants.$id.tsx`: estender `tcDestinations` (state) com `description`, `message`, `mode`, `warmMessage`; ampliar `buildTool()` para montar `destinations[].transferPlan`; ler esses campos ao editar uma tool existente.
- `src/lib/vapi.functions.ts`: mapear cada destino explicitamente no sanitizador do `transferCall` (e do `handoff`).
- Nada de mudança de banco de dados; tudo continua salvando direto na Vapi.
