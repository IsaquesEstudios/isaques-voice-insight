import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type WhatsappChange = {
  value?: {
    metadata?: { phone_number_id?: string };
    contacts?: { wa_id?: string; profile?: { name?: string } }[];
    messages?: {
      id?: string;
      from?: string;
      type?: string;
      timestamp?: string;
      text?: { body?: string };
    }[];
    statuses?: { id?: string; status?: string }[];
  };
};

async function processarEvento(body: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");
  const payload = JSON.parse(body) as {
    entry?: { changes?: WhatsappChange[] }[];
  };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Atualiza o status das mensagens que enviamos.
      for (const status of value?.statuses ?? []) {
        if (!status.id) continue;
        await chatDb
          .from("whatsapp_mensagens")
          .update({ status: status.status ?? null })
          .eq("wa_message_id", status.id);
      }

      const mensagens = value?.messages ?? [];
      if (mensagens.length === 0) continue;

      const { data: numero } = await supabaseAdmin
        .from("whatsapp_numeros")
        .select("user_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!numero) continue;

      for (const mensagem of mensagens) {
        const waId = mensagem.from;
        if (!waId) continue;

        const contato = value?.contacts?.find((c) => c.wa_id === waId);
        const texto =
          mensagem.type === "text"
            ? (mensagem.text?.body ?? "")
            : `[${mensagem.type ?? "mídia"}]`;
        const quando = mensagem.timestamp
          ? new Date(Number(mensagem.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        const { data: conversa, error: conversaError } = await chatDb
          .from("whatsapp_conversas")
          .upsert(
            {
              user_id: numero.user_id,
              phone_number_id: phoneNumberId,
              contato_wa_id: waId,
              contato_nome: contato?.profile?.name ?? null,
              ultima_mensagem: texto,
              ultima_em: quando,
            },
            { onConflict: "phone_number_id,contato_wa_id" }
          )
          .select("id, nao_lidas")
          .maybeSingle<{ id: string; nao_lidas: number | null }>();
        if (conversaError) {
          console.error("whatsapp webhook conversa", conversaError.message);
        }
        if (!conversa) continue;

        const { error: mensagemError } = await chatDb.from("whatsapp_mensagens").upsert(
          {
            conversa_id: conversa.id,
            user_id: numero.user_id,
            wa_message_id: mensagem.id ?? null,
            direcao: "entrada",
            tipo: mensagem.type ?? "text",
            texto,
            status: "recebida",
            criado_em: quando,
          },
          { onConflict: "wa_message_id" }
        );

        if (mensagemError) {
          console.error("whatsapp webhook mensagem", mensagemError.message);
        }

        await chatDb
          .from("whatsapp_conversas")
          .update({ nao_lidas: (conversa.nao_lidas ?? 0) + 1 })
          .eq("id", conversa.id);
      }
    }
  }
}

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env["META_WHATSAPP_VERIFY_TOKEN"];
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const appSecret = process.env["META_APP_SECRET"];
        const signature = request.headers.get("x-hub-signature-256");
        const body = await request.text();

        if (!appSecret || !signature?.startsWith("sha256=")) {
          return new Response("Invalid signature", { status: 401 });
        }
        const expected = createHmac("sha256", appSecret).update(body).digest("hex");
        const received = signature.slice("sha256=".length);
        if (
          received.length !== expected.length ||
          !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          await processarEvento(body);
        } catch (erro) {
          console.error("whatsapp webhook", erro);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
