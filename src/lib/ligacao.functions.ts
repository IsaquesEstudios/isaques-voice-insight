// Ponte entre o painel e o backend FastAPI do usuário (ligacao.py).
// O token de sessão do usuário é repassado no header Authorization, exatamente
// como o `usuario_autenticado()` do FastAPI espera. A URL do backend fica na
// secret LIGACAO_API_URL e nunca é exposta ao navegador.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Use o formato E.164, ex: +5511999999999");

function getBearerToken(): string {
  const authHeader = getRequest()?.headers?.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return token;
}

function getBackendUrl(): string {
  const base = process.env.LIGACAO_API_URL?.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Backend de ligação não configurado (LIGACAO_API_URL ausente).",
    );
  }
  return base;
}

type BackendResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; erro: string };

async function postBackend(path: string, body?: unknown): Promise<BackendResult> {
  let url: string;
  let token: string;
  try {
    url = `${getBackendUrl()}${path}`;
    token = getBearerToken();
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, erro: "Não foi possível alcançar o servidor de ligação." };
  }

  const raw = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    let detail =
      typeof data.detail === "string"
        ? data.detail
        : raw
          ? `Erro ${res.status}: ${raw.slice(0, 300)}`
          : `Erro ${res.status}`;
    if (/alg value is not allowed|Token inválido/i.test(detail)) {
      detail =
        "O backend recusou o token de sessão (assinatura ES256). Configure a verificação do JWT no ligacao.py usando o JWKS do projeto (algorithms=[\"ES256\"]).";
    }
    return { ok: false, erro: detail };
  }

  return { ok: true, data };
}

/** Lê o número salvo direto do banco (RLS limita ao próprio usuário). */
export const getMeuNumeroLigacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("telefones_usuarios")
      .select("telefone, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    // Tabela ausente ou sem permissão: a página segue funcionando sem número salvo.
    if (error) return null;
    return data;
  });


export const salvarNumeroLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ telefone: e164 }).parse(input))
  .handler(async ({ data }) => {
    const result = await postBackend("/api/salvar_numero", { telefone: data.telefone });
    if (!result.ok) return { ok: false as const, erro: result.erro };
    return {
      ok: true as const,
      mensagem: (result.data.mensagem as string) ?? "Número salvo!",
    };
  });

export const fazerLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const result = await postBackend("/api/fazer_ligacao");
    if (!result.ok) return { ok: false as const, erro: result.erro };
    return {
      ok: true as const,
      mensagem: (result.data.mensagem as string) ?? "Ligação disparada!",
      sala: (result.data.sala as string) ?? null,
    };
  });

