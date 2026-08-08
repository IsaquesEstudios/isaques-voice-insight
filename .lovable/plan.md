# Trocar voz do assistente + ajustes na página de Telefonia

## 1. Alterar a voz do assistente (com prévia)

Na página do assistente aberto, aba "Modelo & Voz", o seletor de provedor e de voz já existe. O que falta é ouvir a voz antes de salvar:

- Ao lado do dropdown de voz, um botão de play/pause "Ouvir prévia".
- Só a voz Elliot (provedor Vapi) tem áudio hospedado hoje, então:
  - Elliot: toca a amostra.
  - Demais vozes: botão desabilitado com a dica "Amostra ainda não disponível para esta voz".
- Um único player: ao trocar de voz, fechar a página ou pausar, o áudio para.
- Nenhuma mudança em como a voz é salva na Vapi — segue o mesmo PATCH atual.

## 2. Configurar número (Telefonia)

**Formatação automática do DID em E.164**
- O campo "Número (DID) em E.164" do modal de conexão passa a formatar enquanto o usuário digita: mantém só dígitos, adiciona `+` e assume `+55` quando o usuário digita um número brasileiro sem código de país.
- Exemplo: digitar `11 4002-8922` vira `+551140028922`.
- A validação continua exigindo E.164 válido antes de enviar; a mensagem de erro permanece em pt-BR.

**Remover "Contatos de teste"**
- O card "Contatos de teste" sai da página, junto com o modal "Novo contato".
- Como esse card também abriga o disparo de ligação de teste por linha, essa ação sai junto — o teste de ligação continua disponível pelo teste no navegador na página de Assistentes Virtuais.

## Detalhes técnicos

- `src/routes/_authenticated/assistants.$id.tsx`: adicionar `<audio>` via `useRef`, estado `previewPlaying`, e mapa `VOICE_SAMPLES` (`vapi:Elliot` → `voz-elliot.wav.asset.json`) para decidir quando o botão fica ativo.
- `src/routes/_authenticated/telefonia.tsx`: helper `formatDidE164` aplicado no `onChange` de `sipForm.phoneNumber`; remover o bloco do card de contatos de teste, o dialog `testContactOpen`, os estados `rowCallFrom`/`rowCallAssistant` e os imports/hooks de `listTestContacts`/`saveTestContact`/`removeTestContact`.
- Sem mudanças de banco: a tabela de contatos de teste e as server functions permanecem (apenas deixam de ser usadas na UI).
