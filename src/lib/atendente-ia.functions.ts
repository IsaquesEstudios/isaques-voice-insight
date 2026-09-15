// Atendente por IA (receptivo): configuração por linha SIP do usuário.
// Grava no banco do painel e envia para o backend LiveKit
// (POST /api/livekit/configurar-receptivo).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Use o formato E.164, ex: +5511999999999");

export type AtendenteIaConfig = {
  sip_trunk_id: string;
  telefone: string;
  nome: string;
  usar_ia: boolean;
  prompt: string;
  saudacao: string;
  voz_id: string | null;
  numeros_transferencia: Record<string, string>;
  numero_transferencia_padrao: string | null;
};


/** Linhas SIP do usuário + configuração de atendimento salva. */
export const listarAtendentesIa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: externo } = await import("@/integrations/supabase/admin.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = externo as any;
    const { data: linhas, error } = await db
      .from("configuracoes_sip")
      .select("id, nome_identificacao, telefone_associado, livekit_trunk_id, sip_trunk_id")
      .eq("user_id", context.userId)
      .order("criado_em", { ascending: false });

    if (error) {
      return { ok: false as const, erro: error.message, itens: [] as AtendenteIaConfig[] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: configs } = await supabaseAdmin
      .from("atendentes_ia")
      .select("*")
      .eq("user_id", context.userId);

    const porTrunk = new Map<string, Record<string, unknown>>();
    for (const c of (configs ?? []) as Record<string, unknown>[]) {
      porTrunk.set(String(c.sip_trunk_id), c);
    }

    const itens: AtendenteIaConfig[] = ((linhas ?? []) as Record<string, unknown>[]).map((l) => {
      const trunk = String(l.livekit_trunk_id ?? l.sip_trunk_id ?? "");
      const c = porTrunk.get(trunk);
      return {
        sip_trunk_id: trunk,
        telefone: String(l.telefone_associado ?? ""),
        nome: String(l.nome_identificacao ?? "Linha"),
        usar_ia: c ? Boolean(c.usar_ia) : true,
        prompt: String(c?.prompt ?? ""),
        saudacao: String(c?.saudacao ?? ""),
        voz_id: (c?.voz_id as string | null) ?? null,
        numeros_transferencia:
          (c?.numeros_transferencia as Record<string, string> | undefined) ?? {},
        numero_transferencia_padrao: (c?.numero_transferencia_padrao as string | null) ?? null,
      };
    });

    return { ok: true as const, itens };
  });

export const salvarAtendenteIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sip_trunk_id: z.string().trim().min(1, "Linha sem tronco SIP (ST_...) cadastrado."),
        telefone: z.string().trim().optional(),
        nome: z.string().trim().optional(),
        usar_ia: z.boolean(),
        prompt: z.string().trim().max(8000).default(""),
        saudacao: z.string().trim().max(1000).default(""),
        voz_id: z.string().trim().optional(),
        numeros_transferencia: z.record(z.string().trim().min(1), e164).default({}),
        numero_transferencia_padrao: z
          .union([e164, z.literal("")])
          .optional()
          .transform((v) => (v ? v : undefined)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("atendentes_ia").upsert(
      {
        user_id: context.userId,
        sip_trunk_id: data.sip_trunk_id,
        telefone: data.telefone ?? null,
        nome: data.nome ?? null,
        usar_ia: data.usar_ia,
        prompt: data.prompt,
        saudacao: data.saudacao,
        voz_id: data.voz_id ?? null,
        numeros_transferencia: data.numeros_transferencia,
        numero_transferencia_padrao: data.numero_transferencia_padrao ?? null,
      },
      { onConflict: "user_id,sip_trunk_id" },
    );
    if (error) {
      return { ok: false as const, erro: `Não foi possível salvar: ${error.message}` };
    }

    // Configura o recebimento de chamadas no LiveKit (tronco de entrada + regra de roteamento).
    const telefone = (data.telefone ?? "").trim();
    if (telefone) {
      try {
        await configurarReceptivoLivekit({
          telefone,
          troncoSaida: data.sip_trunk_id,
          metadata: {
            usar_ia: data.usar_ia,
            prompt: data.prompt,
            saudacao: data.saudacao,
            voz_id: data.voz_id ?? null,
            numeros_transferencia: data.numeros_transferencia,
            numero_transferencia_padrao: data.numero_transferencia_padrao ?? null,
            numero_do_cliente: telefone,
            sip_trunk_id: data.sip_trunk_id,
          },
        });
      } catch (e) {
        return {
          ok: false as const,
          erro: `Configuração salva, mas o recebimento de chamadas falhou: ${
            e instanceof Error ? e.message : String(e)
          }`,
        };
      }
    }

    return { ok: true as const, mensagem: "Atendente configurado com sucesso!" };
  });

/** Garante o tronco de entrada do número e a regra que leva a chamada para a IA. */
async function configurarReceptivoLivekit(opts: {
  telefone: string;
  troncoSaida: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const { getLivekitEnv, livekitHttpUrl, signLivekitJwt } = await import("@/lib/livekit.server");
  const env = getLivekitEnv();
  const base = livekitHttpUrl(env.url);

  // O token de serviço precisa do grant SIP admin, que signLivekitJwt não emite.
  const { SignJWT } = await import("jose");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    video: { roomCreate: true, roomAdmin: true, roomList: true },
    sip: { admin: true, call: true },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.apiKey)
    .setSubject(env.apiKey)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(new TextEncoder().encode(env.apiSecret));
  void signLivekitJwt;

  const twirp = async (method: string, body: unknown): Promise<Record<string, unknown>> => {
    const res = await fetch(`${base}/twirp/livekit.SIP/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`${method} (${res.status}): ${texto.slice(0, 200)}`);
    return texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  };

  type Trunk = { sip_trunk_id: string; numbers?: string[] };
  const entradas = ((await twirp("ListSIPInboundTrunk", {})).items ?? []) as Trunk[];
  let inboundId = entradas.find((t) => (t.numbers ?? []).includes(opts.telefone))?.sip_trunk_id;

  if (!inboundId) {
    const criado = await twirp("CreateSIPInboundTrunk", {
      trunk: {
        name: `omniasyn-inbound-${opts.telefone}`,
        numbers: [opts.telefone],
        krisp_enabled: true,
      },
    });
    inboundId = String(criado.sip_trunk_id ?? "");
  }
  if (!inboundId) throw new Error("LiveKit não devolveu o tronco de entrada.");

  type Regra = { sip_dispatch_rule_id: string; trunk_ids?: string[] };
  const regras = ((await twirp("ListSIPDispatchRule", {})).items ?? []) as Regra[];
  for (const r of regras) {
    if ((r.trunk_ids ?? []).includes(inboundId)) {
      await twirp("DeleteSIPDispatchRule", { sip_dispatch_rule_id: r.sip_dispatch_rule_id });
    }
  }

  await twirp("CreateSIPDispatchRule", {
    trunk_ids: [inboundId],
    name: `atendente-${opts.telefone}`,
    metadata: JSON.stringify(opts.metadata),
    rule: { dispatch_rule_individual: { room_prefix: "call-" } },
  });
}
