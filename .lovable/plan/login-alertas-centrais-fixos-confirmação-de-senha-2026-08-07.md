# Login: alertas centrais fixos + confirmação de senha

## O que muda na tela inicial (`/`)

1. **Alertas fixos no centro**
   - Os toasts laterais (sonner) da tela de login/criação de conta deixam de ser usados para erros e sucessos de autenticação.
   - No lugar, aparece um bloco de alerta dentro do próprio card (acima do formulário), centralizado na tela junto com o card:
     - Erro: fundo/borda em tom destrutivo, ícone de alerta, texto em pt-BR (continua usando a tradução existente de mensagens).
     - Sucesso: fundo/borda em tom de sucesso (verde da marca), ícone de check.
   - O alerta **não some sozinho**: permanece até o usuário fechar no "X" ou até uma nova tentativa de login/cadastro/recuperação.
   - Vale para os três fluxos da página: entrar, criar conta e "esqueci minha senha".

2. **Confirmar senha na criação de conta**
   - Na aba "Criar conta" aparece um segundo campo: "Confirmar senha".
   - Se os dois campos não forem iguais, o cadastro não é enviado e o alerta central mostra "As senhas não coincidem. Digite a mesma senha nos dois campos."
   - O campo de confirmação não aparece na aba "Entrar", e é limpo ao trocar de aba.
   - A regra atual de mínimo de 6 caracteres continua valendo.

## Detalhes técnicos

- Arquivo único: `src/routes/index.tsx`.
- Novo estado local: `confirmPassword` e `alert: { type: 'error' | 'success'; message: string } | null`.
- Substituir as chamadas `toast.success` / `toast.error` desta rota por `setAlert(...)`; `translateError` continua gerando o texto.
- Limpar o alerta no início de cada submit e ao alternar entre abas/modo "esqueci minha senha".
- Alerta renderizado com tokens semânticos (`border-destructive/40 bg-destructive/10 text-destructive`, `border-success/40 bg-success/10`), sem cores fixas.
- Nenhuma mudança de backend, validação de servidor ou nas demais páginas.
