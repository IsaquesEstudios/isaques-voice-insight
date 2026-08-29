# Nova página "Ligação" — frontend para seu backend FastAPI (LiveKit SIP)

Criar uma nova seção no menu lateral chamada **Ligação**, que se conecta ao seu backend FastAPI (`ligacao.py`) para: (1) cadastrar o número de destino do usuário e (2) disparar a ligação de teste com um clique.

## O que será construído

### 1. Como o frontend chama seu backend
- O frontend **não** chama o FastAPI direto do navegador com a URL exposta em código. Em vez disso, criamos uma server function (`createServerFn`) que faz de ponte:
  - `src/lib/ligacao.functions.ts` (novo): pega o token de sessão do usuário logado e repassa para o seu FastAPI no header `Authorization: Bearer <access_token>` — exatamente o que seu `usuario_autenticado()` espera.
  - Funções: `salvarNumeroLigacao(telefone)` → `POST {BACKEND}/api/salvar_numero` e `fazerLigacao()` → `POST {BACKEND}/api/fazer_ligacao`.
- A URL do seu backend fica em uma **secret segura** (`LIGACAO_API_URL`, ex: `https://sua-api.onrender.com`), lida com `process.env` só dentro do handler — nunca exposta no navegador. Vou solicitar o valor via formulário seguro na implementação.

### 2. Nova página `/ligacao` (`src/routes/_authenticated/ligacao.tsx`)
Página dentro do painel autenticado, no padrão visual atual (DashboardShell, cards glass, tema claro/escuro Omniasyn):

- **Card "Número de destino"**
  - Campo de telefone com formatação/validação E.164 (`+5511999998888`), reaproveitando o padrão já usado no app.
  - Botão **Salvar número** → chama `salvar_numero` no seu backend.
  - Mostra o número atualmente cadastrado (lido da tabela `telefones_usuarios` do banco, via server function com RLS do usuário).
- **Card "Fazer ligação"**
  - Botão grande **Ligar agora** (desabilitado enquanto não houver número salvo).
  - Estados: discando (spinner), sucesso ("Ligação disparada! Atenda seu telefone."), e erro traduzido para pt-BR (ex: "Telefone não cadastrado", "Trunk SIP não configurado").
  - Aviso discreto de que a chamada usa o tronco SIP configurado e pode gerar custo na operadora.
- Header da página com `head()` próprio ("Ligação — Omniasyn").

### 3. Menu lateral
- Adicionar item **"Ligação"** (ícone `PhoneCall`) em `src/components/app-sidebar.tsx`, entre "Assistentes Virtuais" e "Reunião em vídeo".

### 4. Banco de dados
- Seu backend grava em `telefones_usuarios`. Para o frontend **ler** o número salvo sem expor nada, criamos uma migração mínima:
  - Tabela `telefones_usuarios` (`user_id`, `telefone`, timestamps) com GRANTs e RLS por `auth.uid()` — cada usuário só vê o próprio número.
  - Se a tabela já existir no banco, a migração só garante grants/policies (uso `IF NOT EXISTS`).

## Fora de escopo
- Não alteramos seu código Python/FastAPI (ele já está pronto).
- A configuração do trunk SIP (`buscar_trunk_id_do_usuario`) continua do seu lado — a página apenas exibe o erro amigável se não estiver configurado.

## Verificação
1. Salvar número com formato inválido → erro em pt-BR; com E.164 → salvo e visível no card.
2. Clicar "Ligar agora" → chamada ao backend com o token da sessão; sucesso mostra confirmação; falhas (401/404/502) aparecem traduzidas.
3. Trocar de página e voltar → número carrega do cache (navegação instantânea, padrão do app).

## Detalhes técnicos
- A server function usa `requireSupabaseAuth` e pega o `access_token` da sessão do usuário para repassar ao FastAPI (que valida com `SUPABASE_JWT_SECRET`).
- Importante: seu FastAPI precisa validar tokens do **mesmo projeto Supabase** que este app usa — confirmo isso na implementação (o JWT secret do seu `.env` deve ser o do projeto `krumswystdvenzlbllbe`).
- CORS: como a chamada sai do servidor Lovable (não do navegador), o CORS do FastAPI não bloqueia nada.
