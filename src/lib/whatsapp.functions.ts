import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Dados públicos necessários para abrir o Cadastro Incorporado da Meta. */
export const obterConfigWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const appId = process.env["META_APP_ID"];
    const configId = process.env["META_WHATSAPP_CONFIG_ID"];
    return {
      appId: appId ?? null,
      configId: configId ?? null,
      configurado: Boolean(appId && configId && process.env["META_APP_SECRET"]),
    };
  });

export const listarNumerosWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("whatsapp_numeros")
      .select("id, waba_id, phone_number_id, display_phone_number, verified_name, status")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const removerNumeroWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Número inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_numeros")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type ConectarInput = {
  code: string;
  wabaId?: string | null;
  phoneNumberId?: string | null;
};

/** Troca o código do Cadastro Incorporado por um token e salva os números da conta. */
export const conectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ConectarInput) => {
    if (!input?.code) throw new Error("Código de autorização ausente.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const appId = process.env["META_APP_ID"];
    const appSecret = process.env["META_APP_SECRET"];
    if (!appId || !appSecret) {
      throw new Error(
        "A integração com a Meta ainda não está configurada nesta conta."
      );
    }

    const tokenUrl = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(
      appId
    )}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(
      data.code
    )}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(
        tokenJson.error?.message ??
          "Não foi possível concluir a conexão com a Meta."
      );
    }
    const accessToken = tokenJson.access_token;

    let wabaId = data.wabaId ?? null;
    if (!wabaId) {
      const dbg = await fetch(
        `${GRAPH}/debug_token?input_token=${encodeURIComponent(
          accessToken
        )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
      );
      const dbgJson = (await dbg.json()) as {
        data?: {
          granular_scopes?: { scope: string; target_ids?: string[] }[];
        };
      };
      wabaId =
        dbgJson.data?.granular_scopes?.find(
          (s) => s.scope === "whatsapp_business_management"
        )?.target_ids?.[0] ?? null;
    }
    if (!wabaId) {
      throw new Error(
        "Não encontramos uma conta comercial do WhatsApp vinculada a esse login."
      );
    }

    // Assina o app para receber as mensagens dessa conta comercial.
    await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const numerosRes = await fetch(
      `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const numerosJson = (await numerosRes.json()) as {
      data?: {
        id: string;
        display_phone_number?: string;
        verified_name?: string;
        code_verification_status?: string;
      }[];
      error?: { message?: string };
    };
    if (!numerosRes.ok) {
      throw new Error(
        numerosJson.error?.message ?? "Não foi possível listar os números."
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("whatsapp_accounts").upsert(
      {
        user_id: context.userId,
        waba_id: wabaId,
        access_token: accessToken,
      },
      { onConflict: "user_id,waba_id" }
    );

    const lista = (numerosJson.data ?? []).filter(
      (n) => !data.phoneNumberId || n.id === data.phoneNumberId
    );

    if (lista.length > 0) {
      const { error } = await supabaseAdmin.from("whatsapp_numeros").upsert(
        lista.map((n) => ({
          user_id: context.userId,
          waba_id: wabaId!,
          phone_number_id: n.id,
          display_phone_number: n.display_phone_number ?? null,
          verified_name: n.verified_name ?? null,
          status:
            n.code_verification_status === "VERIFIED" ? "conectado" : "pendente",
        })),
        { onConflict: "user_id,phone_number_id" }
      );
      if (error) throw new Error(error.message);
    }

    return { ok: true, total: lista.length };
  });
