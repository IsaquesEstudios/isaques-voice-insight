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

async function postBackend(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const url = `${getBackendUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getBearerToken()}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Não foi possível alcançar o servidor de ligação.");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : `Erro ${res.status}`;
    throw new Error(detail);
  }
  return data;
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
    if (error) throw new Error(error.message);
    return data;
  });

export const salvarNumeroLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ telefone: e164 }).parse(input))
  .handler(async ({ data }) => {
    const result = await postBackend("/api/salvar_numero", { telefone: data.telefone });
    return { ok: true as const, mensagem: (result.mensagem as string) ?? "Número salvo!" };
  });

export const fazerLigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const result = await postBackend("/api/fazer_ligacao");
    return {
      ok: true as const,
      mensagem: (result.mensagem as string) ?? "Ligação disparada!",
      sala: (result.sala as string) ?? null,
    };
  });
