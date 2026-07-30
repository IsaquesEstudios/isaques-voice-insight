/**
 * Tradução de mensagens de erro técnicas (Vapi, Supabase, rede, SIP)
 * para português do Brasil, usada em todos os toasts do painel.
 */

type Rule = { test: RegExp; message: string };

const RULES: Rule[] = [
  // ---------- Autenticação (Supabase) ----------
  { test: /invalid login credentials/i, message: "E-mail ou senha incorretos." },
  { test: /email not confirmed/i, message: "Confirme seu e-mail antes de entrar." },
  { test: /user already registered|already been registered/i, message: "Este e-mail já possui cadastro." },
  { test: /weak.?password|known to be weak|pwned|easy to guess/i, message: "Esta senha é considerada fraca ou já apareceu em vazamentos públicos. Escolha outra senha, com pelo menos 8 caracteres, misturando letras, números e símbolos." },
  { test: /password should be at least (\d+)/i, message: "A senha deve ter pelo menos 6 caracteres." },
  { test: /invalid email|unable to validate email/i, message: "E-mail inválido." },
  { test: /email rate limit|over_email_send_rate_limit/i, message: "Muitas tentativas de envio de e-mail. Aguarde alguns minutos." },
  { test: /for security purposes.*(\d+) seconds/i, message: "Por segurança, aguarde alguns segundos antes de tentar novamente." },
  { test: /token has expired|invalid or expired|jwt expired/i, message: "Sua sessão expirou. Faça login novamente." },
  { test: /auth session missing|not authenticated|unauthenticated/i, message: "Você precisa estar logado para continuar." },
  { test: /signups? not allowed|signup is disabled/i, message: "Novos cadastros estão desativados no momento." },
  { test: /unsupported provider/i, message: "Este método de login ainda não está habilitado." },

  // ---------- Permissões / banco ----------
  { test: /row-level security|violates row-level|permission denied/i, message: "Você não tem permissão para executar esta ação." },
  { test: /duplicate key value|already exists/i, message: "Este registro já existe." },
  { test: /could not find the table|schema cache/i, message: "Recurso indisponível no banco de dados. Tente novamente em instantes." },
  { test: /foreign key constraint/i, message: "Este item está vinculado a outro registro e não pode ser removido." },

  // ---------- Credenciais das integrações ----------
  { test: /vapi.*(not configured|missing|credentials)|configure.*vapi/i, message: "Configure sua chave da Vapi em Configurações → API & Chaves." },
  { test: /nvoip.*(not configured|missing|credentials)/i, message: "Configure suas credenciais Nvoip em Configurações." },
  { test: /invalid (api )?key|invalid token|api key/i, message: "Chave de API inválida. Verifique suas credenciais." },
  { test: /\b401\b|unauthorized/i, message: "Acesso não autorizado. Verifique suas credenciais de API." },
  { test: /\b403\b|forbidden/i, message: "Acesso negado pelo provedor. Verifique as permissões da sua conta." },
  { test: /\b404\b|not found|does not exist/i, message: "Recurso não encontrado. Ele pode ter sido removido." },
  { test: /\b429\b|rate limit|too many requests/i, message: "Muitas requisições em pouco tempo. Aguarde e tente novamente." },
  { test: /\b5\d\d\b|internal server error|bad gateway|service unavailable/i, message: "O serviço está temporariamente indisponível. Tente novamente em instantes." },
  { test: /insufficient (funds|credit|balance)|out of credits|payment required/i, message: "Créditos insuficientes na sua conta do provedor." },

  // ---------- Chamadas / telefonia ----------
  { test: /assistant-did-not-receive-customer-audio/i, message: "A ligação não recebeu áudio do seu microfone." },
  { test: /meeting (has )?ended/i, message: "A sala da chamada foi encerrada." },
  { test: /customer-did-not-answer|no-answer/i, message: "O cliente não atendeu a ligação." },
  { test: /customer-busy|\bbusy\b/i, message: "A linha do cliente estava ocupada." },
  { test: /call\.start\.error-get-transport|transport/i, message: "Falha ao conectar o tronco de voz. Verifique a configuração SIP." },
  { test: /invalid phone number|not a valid phone/i, message: "Número de telefone inválido. Use o formato +55DDDNÚMERO." },
  { test: /(notallowederror|permission denied).*(microphone|audio)|microphone/i, message: "O navegador bloqueou o microfone. Libere o acesso e tente novamente." },

  // ---------- Rede ----------
  { test: /failed to fetch|networkerror|network request failed|fetch failed/i, message: "Falha de conexão. Verifique sua internet e tente novamente." },
  { test: /timeout|timed out|aborted/i, message: "A operação demorou demais e foi cancelada. Tente novamente." },

  // ---------- Validação genérica ----------
  { test: /required|is missing|must not be empty/i, message: "Preencha todos os campos obrigatórios." },
  { test: /invalid|validation failed|bad request|\b400\b/i, message: "Dados inválidos enviados. Revise as informações e tente novamente." },
];

/** Extrai o texto cru de qualquer formato de erro. */
export function extractErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const e = error as Record<string, any>;
  const candidate =
    (typeof e.error === "string" ? e.error : undefined) ??
    e?.error?.message ??
    e?.error?.msg ??
    e?.message ??
    e?.errorMsg ??
    e?.msg ??
    e?.statusText ??
    e?.action;
  if (typeof candidate === "string") return candidate;
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

/** Retorna a mensagem já traduzida (ou o fallback em pt-BR). */
export function translateError(error: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  const raw = extractErrorText(error).trim();
  if (!raw) return fallback;

  // Já está em português? Mantém a mensagem original do próprio app.
  if (/[áàâãéêíóôõúüçÁÂÃÉÊÍÓÔÕÚÇ]|\b(não|falha|erro|informe|número|senha|conta|chamada|assistente)\b/i.test(raw)) {
    return raw;
  }

  for (const rule of RULES) {
    if (rule.test.test(raw)) return rule.message;
  }
  return fallback;
}

/** Mensagem traduzida + detalhe técnico, para alertas mais longos. */
export function translateErrorWithDetail(error: unknown, fallback?: string): string {
  const raw = extractErrorText(error).trim();
  const friendly = translateError(error, fallback);
  if (!raw || raw === friendly) return friendly;
  return `${friendly}\nDetalhe técnico: ${raw}`;
}
