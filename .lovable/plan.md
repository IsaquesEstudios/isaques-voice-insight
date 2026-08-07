# Limite de 4 assistentes + aviso de custo no teste

## 1. Limitar a 4 assistentes de IA

Na página **Assistentes Virtuais**:

- Quando a conta já tiver 4 assistentes, o botão "Novo Assistente" fica desabilitado, com um aviso ao passar o mouse: "Limite de 4 assistentes atingido. Exclua um para criar outro."
- Um contador discreto no topo mostra "3 de 4 assistentes".
- A ação de **Duplicar** também respeita o limite (bloqueada no 4º).
- Proteção no servidor: antes de criar/duplicar, o backend conta os assistentes da conta e recusa com a mensagem "Limite de 4 assistentes atingido." — assim o limite vale mesmo se alguém tentar burlar a tela.

## 2. Aviso de custo antes do teste no navegador

No diálogo de **Teste no navegador**, antes de iniciar a ligação, aparece um bloco de aviso (tom de alerta, ícone de dólar) com:

- Este teste consome créditos reais e é cobrado em **dólar americano (USD)**.
- Recomendação: não ultrapasse **1 minuto** de teste.
- Consulte sua provedora (Vapi e provedores de voz/modelo) para saber o custo exato por minuto.

O botão "Iniciar ligação" só fica habilitado depois que o cliente marcar a caixa "Entendi que o teste tem custo em dólar". Durante a chamada, um cronômetro já existente/curto destaca em amarelo ao passar de 1 minuto, lembrando de encerrar.

## Detalhes técnicos

- `src/routes/_authenticated/assistentes.tsx`: constante `MAX_ASSISTANTS = 4`; desabilita gatilhos de criar/duplicar e exibe contador.
- `src/lib/vapi.functions.ts`: em `createVapiAssistant` e `duplicateVapiAssistant`, contar linhas de propriedade do usuário (`user_assistants`) e lançar erro ao atingir o limite.
- `src/components/assistants/web-call-dialog.tsx`: estado `acknowledged` + `Alert` com checkbox no estado `idle`; timer de duração com destaque após 60s.
