# Assistente de IA para WhatsApp

## Objetivo
Criar agentes de atendimento por IA para o WhatsApp, vinculá-los por número, responder automaticamente novas mensagens e permitir que uma pessoa assuma uma conversa específica.

## O que será construído

### 1. Nova página “Assistente de IA”
- Adicionar a página ao grupo WhatsApp no menu.
- Listar, criar, editar e excluir assistentes da conta atual.
- Formulário com:
  - nome;
  - IA utilizada, inicialmente fixa em Gemini;
  - área: suporte, vendas ou educação;
  - missão;
  - tom;
  - frequência de emojis;
  - idioma fixo em português do Brasil;
  - tamanho das respostas;
  - limites (“não deve”);
  - campo amplo para a inteligência/conhecimento do agente.
- Exibir claramente quais números estão vinculados a cada assistente.

### 2. Chave Gemini em Configurações
- Substituir o aviso vazio de “API & Chaves” por uma configuração real da chave Gemini.
- Permitir salvar, substituir e remover a chave.
- Nunca devolver a chave completa ao navegador; mostrar apenas o estado “configurada” e um final mascarado.
- Criptografar a chave antes de gravá-la e descriptografá-la somente no servidor durante uma resposta automática.

### 3. Vincular cada número a um assistente
- Na página “Números de WhatsApp”, adicionar um seletor de assistente em cada número já conectado.
- Permitir deixar o número sem IA ou escolher um dos assistentes criados pela mesma conta.
- Ao vincular, novas conversas e novas mensagens desse número passam a ser atendidas pelo assistente escolhido por padrão.

### 4. Respostas automáticas reais
- Ao receber uma mensagem de texto pelo webhook:
  1. salvar a mensagem no banco externo como já ocorre;
  2. localizar o assistente vinculado ao número;
  3. verificar se a conversa não foi assumida por uma pessoa;
  4. montar as instruções do agente com identidade, estilo, limites e inteligência;
  5. enviar o histórico recente da conversa ao Gemini;
  6. enviar a resposta pela API oficial do WhatsApp;
  7. salvar a resposta no banco externo para aparecer imediatamente na conversa.
- Impedir respostas duplicadas quando a Meta reenviar o mesmo evento.
- Em falhas de chave, Gemini ou Meta, preservar a mensagem recebida e registrar o estado da tentativa sem enviar resposta inventada.

### 5. Atendimento manual por conversa
- Adicionar no topo da conversa o botão “Assumir conversa”.
- Ao assumir, desativar a IA somente para aquela conversa, sem alterar as outras conversas do mesmo número.
- Mostrar o estado atual do atendimento no topo.
- Disponibilizar “Devolver à IA” para reativar o atendimento automático daquela conversa quando desejado.

### 6. Ampliar a tela do WhatsApp
- Remover o título e o parágrafo introdutório da página.
- Subir a área de conversas e aumentar sua altura para ocupar o espaço útil disponível, mantendo as bordas e os espaçamentos atuais.
- Manter o botão de conectar número somente no estado vazio, quando a conta não tiver nenhum número.

## Segurança e isolamento
- Todos os assistentes, vínculos e credenciais serão associados ao usuário autenticado.
- A chave Gemini ficará criptografada em repouso com uma chave exclusiva do servidor.
- O webhook só usará um agente quando o número, o agente e a credencial pertencerem à mesma conta.
- As novas tabelas ficarão fechadas para acesso direto do navegador; as operações passam por funções autenticadas no servidor.

## Estrutura técnica
- Criar tabelas para assistentes, credencial Gemini, vínculo número/assistente, estado manual por conversa e controle idempotente das respostas.
- Aplicar permissões explícitas, RLS e acesso apenas pelo servidor.
- Criar funções autenticadas para CRUD dos assistentes, chave Gemini, vínculo do número e tomada/devolução da conversa.
- Estender o webhook público existente, mantendo a validação de assinatura da Meta.
- Usar o histórico recente do banco externo como contexto, com limite para manter custo e tempo de resposta controlados.
- Validar a chamada real ao Gemini e o fluxo visual em desktop antes da conclusão.
