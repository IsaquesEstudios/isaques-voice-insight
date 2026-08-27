// Tronco SIP do próprio usuário (opcional). A plataforma não conversa com
// operadora nenhuma: guardamos apenas host/usuário/senha e usamos esses dados
// para criar a credencial `byo-sip-trunk` na Vapi.
// RLS limita tudo a `auth.uid()`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const TABLE = "user_nvoip_credentials";

export type SipTrunk = {
  sipHost: string;
  sipUsername: string;
  sipPassword: string;
  vapiCredentialId: string | null;
};

/* ---------------- credenciais ---------------- */

export const saveSipTrunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sipHost: z.string().trim().min(4, "Host SIP obrigatório").max(120),
        sipUsername: z.string().trim().min(2, "Usuário SIP obrigatório").max(120),
        sipPassword: z.string().trim().min(4, "Senha SIP obrigatória").max(200),
        friendlyLabel: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from(TABLE).upsert(
      {
        user_id: context.userId,
        sip_host: data.sipHost,
        sip_username: data.sipUsername,
        sip_password: data.sipPassword,
        friendly_label: data.friendlyLabel ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    return { ok: true as const };
  });

export const getSipConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from(TABLE)
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

export const disconnectSipTrunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from(TABLE)
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- números (DIDs) ---------------- */

function toE164BR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

// Registra localmente um DID do tronco SIP do usuário.
export const registerSipNumber = createServerFn({ method: "POST" })
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
      twilio_sid: `sip_${crypto.randomUUID()}`,
      phone_number: data.phoneNumber,
      friendly_name: data.friendlyName,
      region: null,
      country_iso: "BR",
      capabilities: { sip: true, voice: true },
      monthly_cost: null,
      provider: "sip",
    });
    if (error) throw new Error(`DB insert failed: ${error.message}`);
    return { ok: true as const, alreadyRegistered: false };
  });
