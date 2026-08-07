# Aviso de confirmação de e-mail no cadastro

Hoje, ao criar a conta, aparece só um alerta curto no card e o formulário volta para "Entrar". A confirmação de e-mail continua obrigatória (nada muda no backend), mas a tela vai explicar claramente o que aconteceu e o que fazer.

## O que muda

Depois de criar a conta (quando o backend não devolve sessão), o card passa a mostrar uma tela dedicada:

- Ícone + título "Confirme seu e-mail"
- Texto: enviamos um link de confirmação para **o e-mail digitado**; verifique também a caixa de spam
- Botão **Reenviar e-mail de confirmação** (com contagem de 60s para evitar bloqueio por limite de envio)
- Botão **Já confirmei — continuar configurando**: verifica se a conta já foi confirmada e, se sim, entra e segue para a configuração; se ainda não, mostra um aviso pedindo para clicar no link do e-mail
- Link **Voltar ao login**

Enquanto o e-mail não estiver confirmado, não é possível entrar — essa é a regra escolhida. O botão "continuar configurando" só destrava depois da confirmação.

## Detalhes técnicos

Arquivo: `src/routes/index.tsx`

- Novo estado `mode: "auth" | "confirm-email"` (o modo `forgot` continua) e `pendingEmail`.
- No `handleSubmit`, ramo signup: quando `data.session` é nulo, em vez de trocar para a aba "signin", define `pendingEmail` e `mode = "confirm-email"`.
- Reenvio: `supabase.auth.resend({ type: "signup", email: pendingEmail, options: { emailRedirectTo: window.location.origin } })`, com cooldown de 60s em `useState` + `setInterval`.
- "Já confirmei": tenta `signInWithPassword` com a senha ainda em memória (ou pede a senha de novo se estiver vazia); em sucesso navega para `/dashboard`; em erro `email_not_confirmed` mostra o alerta traduzido via `translateError`.
- Reaproveita o bloco de alerta existente e os tokens semânticos atuais; nenhuma mudança em configurações de autenticação do backend.
