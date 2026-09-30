# Isaques Voice Hub

Ação Principal: Crie um painel de controle (Dashboard) completo, moderno e responsivo para uma plataforma SaaS de Inteligência Artificial de Voz. Por favor, use a imagem em anexo como a principal referência de estilo visual (cores, espaçamentos, tipografia e formato dos cartões). A interface deve ser baseada em Tailwind CSS e componentes no estilo shadcn/ui.

Branding:

O nome da plataforma (logo no topo da barra lateral) deve ser "Isaques Estúdios | AI Voice".

O design deve transmitir confiabilidade técnica e alta conversão (clean, com bom contraste).

Estrutura de Navegação (Sidebar Fixa): Inclua os seguintes links com ícones minimalistas (Lucide):

📊 Dashboard (Visão Geral)

🤖 Assistentes Virtuais

📞 Telefonia & Números (Gestão de rotas e anti-spam)

📥 CRM & Leads (Caixa de Entrada)

📋 Histórico de Chamadas (Logs)

⚙️ Configurações / API

Área Principal - Tela de Dashboard (Grid Layout):

Seção 1: Cartões de Métricas (Top Header) 4 cartões com as estatísticas do mês atual e um pequeno badge verde/vermelho indicando a variação percentual:

Total de Ligações

Custos da Operação (Vapi + Twilio)

Leads Qualificados

Taxa de Atendimento (Health Score)

Seção 2: Gráficos e Saúde da Operação Divida esta seção em duas colunas (2/3 e 1/3):

Coluna Maior (Gráfico): Um gráfico de área comparando o volume de "Ligações Ativas (Outbound)" vs "Ligações Recebidas (Inbound)" ao longo dos últimos 15 dias.

Coluna Menor (Widget Anti-Spam): Um cartão chamado "Status de Rotação (Number Pooling)". Ele deve mostrar uma pequena lista de 3 números fictícios com um indicador de "Saúde" (ex: uma bolinha verde para "Seguro", amarela para "Descanso", vermelha para "Risco de Spam").

Seção 3: Tabela de Chamadas Recentes Uma tabela inferior elegante listando as últimas interações. Colunas:

Data/Hora

Tipo (Tag visual: Inbound ou Outbound)

Telefone do Cliente

Duração

Status Final (Tag visual: "Transferido", "Caixa Postal", "Qualificado")

Ação (Botão de 'Play' para o áudio e botão 'Ver Resumo').

Estilo e Comportamento (UI/UX):

Aplique efeitos sutis de hover nos botões e linhas da tabela.

Crie os cartões com bordas suaves (border-radius médio) e leve sombra (drop-shadow).

O painel deve ter um botão de perfil/usuário no canto superior direito para opções de faturamento.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://isaques-voice-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/818d1939-d4df-4ca2-b1af-4e1dda55214f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
