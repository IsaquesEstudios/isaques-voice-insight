# Rebranding Omniasyn + tema claro/escuro

## O que muda

**1. Nova identidade visual**
- Nome da plataforma passa de "Isaques Estúdios | AI Voice" para **Omniasyn** em todos os lugares (sidebar, títulos das páginas, tela de login, onboarding, metadados/SEO).
- Logo enviada é usada na sidebar e nas telas públicas: versão escura no tema claro, versão branca no tema escuro.
- Favicon atualizado com a nova marca.

**2. Nova paleta de cores**
- Cor primária: `#00acdc` (azul ciano)
- Cor secundária/acento: `#2abb65` (verde)
- Degradês, brilhos, gráficos e barras de progresso passam a usar esses dois tons.

**3. Botão claro/escuro**
- Botão na barra superior alterna entre tema **claro (fundo branco)** e **escuro (fundo preto)**.
- A escolha fica salva no navegador e é aplicada já no primeiro carregamento (sem "piscar" de tela).
- Tema escuro continua sendo o padrão para quem nunca escolheu.

## Detalhes técnicos

- `src/styles.css`: reescrever os tokens `:root` (tema claro, fundo branco `oklch(1 0 0)`) e `.dark` (fundo preto/near-black), com `--primary` = #00acdc e `--chart-2`/`--accent` = #2abb65 convertidos para oklch. Atualizar `--shadow-glow` e o gradiente de fundo no `@layer base` para os novos tons.
- Novo `src/components/theme-toggle.tsx` + hook de tema que aplica/remove a classe `dark` em `<html>` e persiste em `localStorage`.
- `src/routes/__root.tsx`: remover `className="dark"` fixo do `<html>`, injetar um pequeno script inline no `<head>` que aplica o tema salvo antes da hidratação; atualizar `<Toaster theme>` para acompanhar o tema; atualizar títulos/descrições/og para Omniasyn; trocar o `rel="icon"`.
- `src/components/dashboard/topbar.tsx`: adicionar o botão de alternância ao lado do sino.
- Logos publicadas via `lovable-assets` (pointer `.asset.json` em `src/assets`) e usadas em `app-sidebar.tsx`, `index.tsx`, `reset-password.tsx` e `onboarding.tsx`, escolhendo a variante conforme o tema.
- Favicon quadrado gerado a partir da logo e salvo em `public/favicon.png`.
- Substituir todas as strings "Isaques Estúdios | AI Voice" nos arquivos de rota por "Omniasyn".
- Revisar classes de cor fixas (ex.: `bg-amber-500`, gradientes `from-primary to-chart-3`) para garantir contraste nos dois temas.
