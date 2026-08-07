# Perfil real: Nome e Empresa no cadastro e nas Configurações

## O que está acontecendo hoje

Confirmei no código:

- Em **Configurações → Perfil**, os campos são valores fixos escritos no código ("Isaque Silva", "isaque@isaquesestudios.com", "Omniasyn", iniciais "IE"). Nada vem da conta, e o botão "Salvar alterações" não salva nada.
- No **cadastro** (tela de login/criar conta) só pedimos e-mail e senha — não há campos de Nome nem Empresa, e nenhum dado extra é enviado junto com a criação da conta.
- No **topo do painel** o nome do usuário também é fixo ("Ryan Coleford / Admin").
- Não existe hoje nenhuma tabela de perfil no banco para guardar esses dados.

Ou seja: não bate porque nunca foi pedido nem guardado.

## O que será feito

1. **Cadastro pede Nome completo e Empresa**
   - Novos campos na aba "Criar conta", acima de e-mail.
   - Nome é obrigatório; Empresa é opcional.
   - Os dados vão junto na criação da conta e são gravados no perfil.

2. **Tabela de perfis no banco**
   - Guarda nome, empresa, e-mail, fuso horário e foto (URL), ligada ao usuário.
   - Criada automaticamente no primeiro acesso/cadastro, inclusive para quem já tem conta (preenche com o e-mail existente).
   - Cada usuário só enxerga e edita o próprio perfil.

3. **Configurações → Perfil passa a ser real**
   - Carrega Nome, E-mail, Empresa e Fuso horário da conta (com skeleton enquanto carrega).
   - "Salvar alterações" grava de verdade, com aviso de sucesso/erro em português.
   - E-mail fica somente leitura (é o e-mail de login).
   - Iniciais do avatar geradas a partir do nome real. O botão "Alterar foto" continua desativado por enquanto (upload não faz parte desta entrega) — posso incluir se quiser.

4. **Topo do painel mostra o usuário real**
   - Nome e iniciais vindos do perfil, com o e-mail no lugar do rótulo fixo "Admin".

## Detalhes técnicos

- Migração: `public.profiles` (`id uuid PK → auth user`, `full_name`, `company`, `email`, `timezone` default `America/Sao_Paulo`, `avatar_url`, timestamps), GRANTs para `authenticated`/`service_role`, RLS com políticas `auth.uid() = id` para select/insert/update.
- `signUp` passa `options.data = { full_name, company }`; trigger `on_auth_user_created` insere em `profiles` usando os metadados.
- Novo `src/lib/profile.functions.ts` com `getMyProfile` / `updateMyProfile` via `createServerFn` + `requireSupabaseAuth` (upsert no get para cobrir contas antigas).
- `configuracoes.tsx` (`PerfilSection`) e `topbar.tsx` consomem `useQuery(["my-profile"])`; update invalida a mesma chave.
