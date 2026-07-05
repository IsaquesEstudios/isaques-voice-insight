# Dashboard "Isaques Estúdios | AI Voice"

Vou construir um painel dark-mode inspirado na referência (fundo quase-preto com acentos teal/verde-neon, cartões com bordas suaves e leve glow), usando Tailwind v4 + shadcn/ui + Recharts + Lucide, com dados mockados.

## Design tokens (src/styles.css)
- Fundo base: preto azulado `oklch(0.15 0.02 200)` com gradiente sutil
- Superfície de cartão: `oklch(0.20 0.02 200)` com borda `oklch(1 0 0 / 8%)`
- Primária (accent neon): teal `oklch(0.82 0.17 165)` (~ #4ade9e)
- Sucesso/Aviso/Risco: verde, amarelo, vermelho em oklch
- Tipografia: Inter (via `<link>` no `__root.tsx`)
- Radius médio (0.9rem), sombra suave com tint teal
- Force dark mode aplicando classe `dark` no `<html>`

## Estrutura de arquivos
- `src/routes/__root.tsx` — adicionar `<link>` Inter, atualizar `<head>` (título "Isaques Estúdios | AI Voice — Dashboard"), aplicar classe `dark`
- `src/routes/index.tsx` — layout com Sidebar + main dashboard (substituir placeholder)
- `src/routes/assistentes.tsx`, `telefonia.tsx`, `crm.tsx`, `historico.tsx`, `configuracoes.tsx` — stubs simples (só título) para os links funcionarem
- `src/components/app-sidebar.tsx` — Sidebar shadcn com branding e navegação
- `src/components/dashboard/metric-card.tsx` — cartão de métrica com badge de variação
- `src/components/dashboard/calls-area-chart.tsx` — Recharts area (Outbound vs Inbound, 15 dias)
- `src/components/dashboard/number-pooling.tsx` — widget anti-spam
- `src/components/dashboard/recent-calls-table.tsx` — tabela com tags e ações
- `src/components/dashboard/topbar.tsx` — busca + notificações + avatar/menu perfil (dropdown com Faturamento, Configurações, Sair)

## Layout do Dashboard
```
┌─────────────┬──────────────────────────────────────────────┐
│  Sidebar    │  Topbar (busca • notif • perfil)            │
│  (fixa)     ├──────────────────────────────────────────────┤
│  Logo       │  [Ligações] [Custos] [Leads] [Atendimento]  │
│  Nav (6)    ├──────────────────────────┬───────────────────┤
│             │  Área Chart Inbound/Out  │ Number Pooling    │
│  Card CTA   │  (2/3)                   │ (1/3)             │
│  Créditos   ├──────────────────────────┴───────────────────┤
│             │  Tabela Chamadas Recentes                    │
└─────────────┴──────────────────────────────────────────────┘
```

## Detalhes das seções
- **Metric cards** (4): título muted, valor grande, badge pill verde `+12.4%` / vermelho `-3.1%` com ícone TrendingUp/Down, sparkline discreta opcional
- **Area chart**: 15 pontos mock, duas séries (Outbound teal, Inbound roxo suave), gradiente de preenchimento, tooltip customizado dark
- **Number Pooling**: 3 números BR fictícios, badge de saúde (verde "Seguro", amarelo "Descanso", vermelho "Risco de Spam") com bolinha pulsante, contador de chamadas do dia
- **Tabela**: 6-8 linhas mock; tags para Tipo (Inbound/Outbound) e Status (Transferido/Caixa Postal/Qualificado) com cores semânticas; ações Play (ícone) + "Ver Resumo" (botão ghost); hover row destacado

## Interações
- Sidebar colapsável (SidebarProvider) com trigger visível na topbar
- Rotas ativas destacadas via `useRouterState`
- Hover suave em botões, linhas e cartões (translate/glow leve)
- Responsivo: sidebar vira offcanvas em mobile, cards empilham, chart mantém altura mínima, tabela com scroll horizontal

## Dependências
- `recharts` já é padrão shadcn — instalar se ausente
- Nenhuma nova dep além disso

## Fora de escopo
- Backend / dados reais (tudo mockado em arquivos TS)
- Autenticação
- Páginas internas além dos stubs (Assistentes, Telefonia etc. ficam com "Em breve")