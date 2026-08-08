# Prévia de voz + conclusão manual no passo 2

## O que muda

**1. Escutar a voz na criação do assistente**
- O áudio enviado (`2026-08-06_18-41-51.wav`) passa a ser hospedado como asset do projeto e vira a amostra da voz Elliot (vapi).
- No passo 2 ("Modelo & Voz"), cada card de padrão de IA ganha um botão de play/pause para ouvir a voz antes de criar.
- Só um áudio toca por vez; ao fechar o modal o áudio para.

**2. Nada de conclusão automática**
- Hoje o padrão único já vem pré-selecionado, então ao chegar no passo 2 nada exige ação do usuário e o fluxo parece se concluir sozinho.
- O passo 2 passa a começar sem seleção: o usuário precisa clicar no card do padrão para selecioná-lo.
- O botão "Criar Assistente" fica desabilitado enquanto nenhum padrão estiver selecionado, com um texto de apoio ("Selecione um padrão de IA para continuar").
- Também é evitado o envio acidental por Enter no passo 2 — só o clique no botão conclui.

## Detalhes técnicos

- Hospedar o `.wav` via `lovable-assets create` e importar o ponteiro `.asset.json`; adicionar `sampleUrl` em `AssistantPreset`.
- Em `src/routes/_authenticated/assistentes.tsx`: adicionar `presetId: string | null` ao `FormState` (nulo ao abrir a criação; preenchido a partir do assistente ao editar), um `<audio>` controlado por `useRef` e estado `playingPresetId`.
- O botão de submit usa `disabled={... || !form.presetId}`; `handleSubmit` retorna cedo se não houver seleção.
- Sem mudanças no backend nem no payload enviado à Vapi (mesmos campos `model`/`voice`).
