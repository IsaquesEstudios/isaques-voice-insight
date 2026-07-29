// Operações Nvoip executadas sempre com as credenciais que o usuário atual
// guardou em `user_nvoip_credentials` — a plataforma nunca usa uma conta
// compartilhada. RLS limita tudo a `auth.uid()`.
//
// A API REST da Nvoip vive em https://api.nvoip.com.br/v2 e aceita
// autenticação por Bearer (OAuth2) ou pelo parâmetro/cabeçalho `Napikey`.
// Como a documentação pública varia entre versões, os helpers abaixo tentam
// uma lista de caminhos candidatos e degradam com elegância quando o recurso
// não existe na conta — nunca derrubam a tela.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NVOIP_API = "https://api.nvoip.com.br/v2";

export type NvoipCreds = {
  apiKey: string | null;
  clientId: string | null;
  clientSecret: string | null;
  sipHost: string;
  sipUsername: string;
  sipPassword: string;
  vapiCredentialId: string | null;
};

type SupabaseCtx = { supabase: { from: (t: string) => any } };

export async function loadNvoipCreds(
  context: SupabaseCtx & { userId: string },
): Promise<NvoipCreds | null> {
  const { data, error } = await context.supabase
    .from("user_nvoip_credentials")
    .select(
      "api_key, client_id, client_secret, sip_host, sip_username, sip_password, vapi_credential_id",
    )
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    apiKey: (data.api_key as string | null) ?? null,
    clientId: (data.client_id as string | null) ?? null,
    clientSecret: (data.client_secret as string | null) ?? null,
    sipHost: (data.sip_host as string) ?? "sip.nvoip.com.br",
    sipUsername: data.sip_username as string,
    sipPassword: data.sip_password as string,
    vapiCredentialId: (data.vapi_credential_id as string | null) ?? null,
  };
}

// Troca client_id/secret por um access token OAuth2. Só é usado quando o
// usuário não informou uma Napikey.
async function fetchOAuthToken(creds: NvoipCreds): Promise<string | null> {
  if (!creds.clientId || !creds.clientSecret) return null;
  try {
    const res = await fetch(`${NVOIP_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; token?: string };
    return json.access_token ?? json.token ?? null;
  } catch {
    return null;
  }
}

async function nvoipHeaders(creds: NvoipCreds): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (creds.apiKey) {
    headers["Napikey"] = creds.apiKey;
  } else {
    const token = await fetchOAuthToken(creds);
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

type NvoipResult<T> =
  | { ok: true; data: T; path: string }
  | { ok: false; status: number | null; message: string };

// Tenta cada caminho candidato até um responder 2xx.
async function nvoipTry<T>(
  creds: NvoipCreds,
  paths: string[],
  init?: RequestInit,
): Promise<NvoipResult<T>> {
  const headers = await nvoipHeaders(creds);
  let lastStatus: number | null = null;
  let lastMessage = "Nenhum endpoint da Nvoip respondeu.";
  for (const path of paths) {
    try {
      const res = await fetch(`${NVOIP_API}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      });
      const text = await res.text();
      if (res.ok) {
        return {
          ok: true,
          path,
          data: (text ? JSON.parse(text) : {}) as T,
        };
      }
      lastStatus = res.status;
      lastMessage = `Nvoip ${res.status}: ${text.slice(0, 400)}`;
      // 401/403 é problema de credencial: não adianta tentar outros caminhos.
      if (res.status === 401 || res.status === 403) break;
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, status: lastStatus, message: lastMessage };
}

/* ---------------- credenciais ---------------- */

export const saveNvoipCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        apiKey: z.string().trim().max(400).optional().or(z.literal("")),
        clientId: z.string().trim().max(200).optional().or(z.literal("")),
        clientSecret: z.string().trim().max(400).optional().or(z.literal("")),
        sipHost: z.string().trim().min(4, "Host SIP obrigatório").max(120),
        sipUsername: z.string().trim().min(2, "Usuário SIP obrigatório").max(120),
        sipPassword: z.string().trim().min(4, "Senha SIP obrigatória").max(200),
        friendlyLabel: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const creds: NvoipCreds = {
      apiKey: data.apiKey || null,
      clientId: data.clientId || null,
      clientSecret: data.clientSecret || null,
      sipHost: data.sipHost,
      sipUsername: data.sipUsername,
      sipPassword: data.sipPassword,
      vapiCredentialId: null,
    };

    // A API REST é opcional: um tronco SIP puro só precisa de host/usuário/senha.
    // Quando há Napikey/OAuth validamos a conta; 401/403 significa credencial errada.
    const hasApi = Boolean(creds.apiKey || (creds.clientId && creds.clientSecret));
    const probe = hasApi
      ? await nvoipTry<unknown>(creds, [
          "/account",
          "/users/me",
          "/dids",
          "/callhistory?page=0&size=1",
        ])
      : ({ ok: false, status: null, message: "sem api" } as const);
    if (hasApi && !probe.ok && (probe.status === 401 || probe.status === 403)) {
      throw new Error(
        "Credenciais de API recusadas (401/403). Confira a chave ou o Client ID/Secret no painel da operadora.",
      );
    }


    const { error } = await context.supabase.from("user_nvoip_credentials").upsert(
      {
        user_id: context.userId,
        api_key: creds.apiKey,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        sip_host: creds.sipHost,
        sip_username: creds.sipUsername,
        sip_password: creds.sipPassword,
        friendly_label: data.friendlyLabel ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    return { ok: true as const, apiValidated: probe.ok };
  });

export const getNvoipConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_nvoip_credentials")
      .select("sip_host, sip_username, friendly_label, vapi_credential_id, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      sipHost: data.sip_host as string,
      sipUsername: data.sip_username as string,
      friendlyLabel: (data.friendly_label as string | null) ?? null,
      vapiCredentialId: (data.vapi_credential_id as string | null) ?? null,
      updatedAt: data.updated_at as string,
    };
  });

export const disconnectNvoip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_nvoip_credentials")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- números (DIDs) ---------------- */

export type NvoipNumber = {
  number: string;
  label: string | null;
};

function toE164BR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

function extractNumbers(payload: unknown): NvoipNumber[] {
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { content?: unknown })?.content)
      ? ((payload as { content: unknown[] }).content as unknown[])
      : Array.isArray((payload as { data?: unknown })?.data)
        ? ((payload as { data: unknown[] }).data as unknown[])
        : [];
  const out: NvoipNumber[] = [];
  for (const item of arr) {
    const o = (item ?? {}) as Record<string, unknown>;
    const candidate =
      (o.did as string) ??
      (o.number as string) ??
      (o.numero as string) ??
      (o.phone as string) ??
      (o.telefone as string) ??
      "";
    if (!candidate) continue;
    out.push({
      number: toE164BR(String(candidate)),
      label:
        (o.name as string) ??
        (o.description as string) ??
        (o.descricao as string) ??
        null,
    });
  }
  return out;
}


// Lista os DIDs contratados na conta Nvoip do usuário.
export const listNvoipNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await loadNvoipCreds(context);
    if (!creds) return { connected: false as const, numbers: [] as NvoipNumber[] };
    const res = await nvoipTry<unknown>(creds, ["/dids", "/did", "/numbers", "/telefones"]);
    if (!res.ok) {
      return {
        connected: true as const,
        numbers: [] as NvoipNumber[],
        warning: res.message,
      };
    }
    return { connected: true as const, numbers: extractNumbers(res.data) };
  });

// Saldo/créditos da conta Nvoip. Retorna `available: false` quando a conta
// não expõe o recurso — o card na UI apenas some nesse caso.
export const getNvoipBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const creds = await loadNvoipCreds(context);
    if (!creds) return { available: false as const, reason: "not_connected" as const };
    const res = await nvoipTry<Record<string, unknown>>(creds, [
      "/account/balance",
      "/balance",
      "/credits",
      "/account",
    ]);
    if (!res.ok) return { available: false as const, reason: "unsupported" as const };
    const o = res.data ?? {};
    const rawValue =
      o.balance ?? o.saldo ?? o.credits ?? o.creditos ?? (o.account as any)?.balance;
    const value = typeof rawValue === "string" ? Number(rawValue) : (rawValue as number);
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { available: false as const, reason: "unsupported" as const };
    }
    return {
      available: true as const,
      balance: value,
      currency: (o.currency as string) ?? "BRL",
    };
  });

// Registra um DID Nvoip localmente (a compra em si é feita no painel da
// Nvoip; aqui apenas vinculamos o número à conta do usuário).
export const registerNvoipNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        phoneNumber: z
          .string()
          .trim()
          .min(8)
          .transform((v) => toE164BR(v)),
        friendlyName: z.string().trim().min(2).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("user_phone_numbers")
      .select("id")
      .eq("user_id", context.userId)
      .eq("phone_number", data.phoneNumber)
      .maybeSingle();
    if (existing) return { ok: true as const, alreadyRegistered: true };

    const { error } = await context.supabase.from("user_phone_numbers").insert({
      user_id: context.userId,
      // coluna legada de identificador do provedor no banco
      twilio_sid: `nvoip_${crypto.randomUUID()}`,
      phone_number: data.phoneNumber,
      friendly_name: data.friendlyName,
      region: null,
      country_iso: "BR",
      capabilities: { nvoip: true, voice: true },
      monthly_cost: null,
      provider: "nvoip",
    });
    if (error) throw new Error(`DB insert failed: ${error.message}`);
    return { ok: true as const, alreadyRegistered: false };
  });
