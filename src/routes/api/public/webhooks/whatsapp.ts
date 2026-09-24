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
      image?: { id?: string; mime_type?: string; caption?: string };
      audio?: { id?: string; mime_type?: string };
      video?: { id?: string; mime_type?: string; caption?: string };
      document?: { id?: string; mime_type?: string; caption?: string; filename?: string };
      sticker?: { id?: string; mime_type?: string };
    }[];
    statuses?: { id?: string; status?: string }[];
  };
};

const GRAPH = "https://graph.facebook.com/v26.0";

async function responderComIa(input: {
  userId: string;
  conversationId: string;
  phoneNumberId: string;
  contactWaId: string;
  inboundMessageId: string;
  agentId: string;
}) {
  const { chatDb: supabaseAdmin } = await import("@/integrations/supabase/chat-db.server");
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");

  // Agrupa rajadas: espera 8s e só responde se esta ainda for a última mensagem do cliente.
  // A resposta usa todo o histórico recente, incluindo todas as mensagens desde a última da IA.
  await new Promise((resolve) => setTimeout(resolve, 8_000));
  const { data: ultima } = await chatDb
    .from("whatsapp_mensagens")
    .select("wa_message_id")
    .eq("conversa_id", input.conversationId)
    .eq("direcao", "entrada")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima?.wa_message_id && ultima.wa_message_id !== input.inboundMessageId) return;


  const { error: claimError } = await chatDb.from("whatsapp_ai_runs").insert({
    inbound_message_id: input.inboundMessageId,
    user_id: input.userId,
    conversation_id: input.conversationId,
    agent_id: input.agentId,
    status: "processing",
  });
  if (claimError?.code === "23505") return;
  if (claimError) throw new Error(claimError.message);

  try {
    const [{ data: control }, { data: agent }, { data: credential }, { data: number }] =
      await Promise.all([
        chatDb
          .from("whatsapp_ai_conversation_controls")
          .select("manual_takeover")
          .eq("user_id", input.userId)
          .eq("conversation_id", input.conversationId)
          .maybeSingle(),
        chatDb
          .from("whatsapp_ai_agents")
          .select("name, area, mission, tone, emoji_usage, response_length, restrictions, knowledge")
          .eq("id", input.agentId)
          .eq("user_id", input.userId)
          .maybeSingle(),
        chatDb
          .from("whatsapp_ai_credentials")
          .select("gemini_api_key_ciphertext")
          .eq("user_id", input.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("whatsapp_numeros")
          .select("waba_id")
          .eq("phone_number_id", input.phoneNumberId)
          .eq("user_id", input.userId)
          .maybeSingle(),
      ]);
    if (control?.manual_takeover || !agent || !credential || !number) {
      await chatDb
        .from("whatsapp_ai_runs")
        .update({ status: "skipped" })
        .eq("inbound_message_id", input.inboundMessageId);
      return;
    }

    const { data: account } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("access_token")
      .eq("user_id", input.userId)
      .eq("waba_id", number.waba_id)
      .maybeSingle();
    if (!account?.access_token) throw new Error("Autorização da Meta indisponível.");

    let { data: history, error: historyError }: { data: unknown[] | null; error: { message: string } | null } = await chatDb
      .from("whatsapp_mensagens")
      .select("direcao, texto, tipo, media_id, media_mime")
      .eq("conversa_id", input.conversationId)
      .eq("user_id", input.userId)
      .order("criado_em", { ascending: false })
      .limit(40);
    if (historyError) {
      ({ data: history, error: historyError } = await chatDb
        .from("whatsapp_mensagens")
        .select("direcao, texto")
        .eq("conversa_id", input.conversationId)
        .eq("user_id", input.userId)
        .order("criado_em", { ascending: false })
        .limit(40));
    }
    if (historyError) throw new Error(historyError.message);

    type Hist = {
      direcao: string;
      texto: string | null;
      tipo?: string | null;
      media_id?: string | null;
      media_mime?: string | null;
      audio?: { mimeType: string; data: string };
    };
    const ordered = [...((history ?? []) as Hist[])].reverse();

    // Áudios recebidos desde a última resposta: baixa da Meta e envia ao Gemini para ouvir.
    let lastOut = -1;
    ordered.forEach((m, i) => {
      if (m.direcao !== "entrada") lastOut = i;
    });
    let audios = 0;
    for (let i = lastOut + 1; i < ordered.length && audios < 5; i++) {
      const m = ordered[i];
      if (m.tipo !== "audio" || !m.media_id) continue;
      try {
        const metaRes = await fetch(`${GRAPH}/${m.media_id}`, {
          headers: { Authorization: `Bearer ${account.access_token}` },
        });
        const meta = (await metaRes.json().catch(() => ({}))) as { url?: string; mime_type?: string };
        if (!metaRes.ok || !meta.url) continue;
        const fileRes = await fetch(meta.url, {
          headers: { Authorization: `Bearer ${account.access_token}` },
        });
        if (!fileRes.ok) continue;
        const buf = new Uint8Array(await fileRes.arrayBuffer());
        if (buf.byteLength > 15 * 1024 * 1024) continue;
        const mime = (meta.mime_type ?? m.media_mime ?? "audio/ogg").split(";")[0].trim();
        m.audio = { mimeType: mime, data: Buffer.from(buf).toString("base64") };
        audios++;
      } catch (e) {
        console.error("whatsapp ai audio", e instanceof Error ? e.message : e);
      }
    }

    const { decryptApiKey, generateGeminiReply } = await import("@/lib/whatsapp-ai.server");
    const reply = await generateGeminiReply({
      apiKey: await decryptApiKey(credential.gemini_api_key_ciphertext),
      agent,
      history: ordered,
    });

    const sendResponse = await fetch(`${GRAPH}/${input.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.contactWaId,
        type: "text",
        text: { body: reply },
      }),
    });
    const sendPayload = (await sendResponse.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };
    if (!sendResponse.ok) throw new Error(sendPayload.error?.message ?? "A Meta recusou a resposta.");

    const now = new Date().toISOString();
    const { error: saveError } = await chatDb.from("whatsapp_mensagens").insert({
      conversa_id: input.conversationId,
      user_id: input.userId,
      wa_message_id: sendPayload.messages?.[0]?.id ?? null,
      direcao: "saida",
      tipo: "text",
      texto: reply,
      status: "enviada",
      criado_em: now,
    });
    if (saveError) throw new Error(saveError.message);
    await chatDb
      .from("whatsapp_conversas")
      .update({ ultima_mensagem: reply, ultima_em: now })
      .eq("id", input.conversationId);
    await chatDb
      .from("whatsapp_ai_runs")
      .update({ status: "completed", error_message: null })
      .eq("inbound_message_id", input.inboundMessageId);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Falha inesperada.";
    await chatDb
      .from("whatsapp_ai_runs")
      .update({ status: "failed", error_message: message })
      .eq("inbound_message_id", input.inboundMessageId);
    console.error("whatsapp ai reply", message);
  }
}

async function processarEvento(body: string) {
  const { chatDb: supabaseAdmin } = await import("@/integrations/supabase/chat-db.server");
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
        .select("user_id, whatsapp_ai_agent_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!numero) continue;

      for (const mensagem of mensagens) {
        const waId = mensagem.from;
        if (!waId) continue;

        const contato = value?.contacts?.find((c) => c.wa_id === waId);
        const midia =
          mensagem.image ?? mensagem.audio ?? mensagem.video ?? mensagem.document ?? mensagem.sticker;
        const rotuloMidia =
          mensagem.type === "image"
            ? "📷 Foto"
            : mensagem.type === "audio"
              ? "🎤 Áudio"
              : mensagem.type === "video"
                ? "🎬 Vídeo"
                : mensagem.type === "document"
                  ? `📎 ${mensagem.document?.filename ?? "Documento"}`
                  : `[${mensagem.type ?? "mídia"}]`;
        const texto =
          mensagem.type === "text"
            ? (mensagem.text?.body ?? "")
            : (mensagem.image?.caption ??
               mensagem.video?.caption ??
               mensagem.document?.caption ??
               rotuloMidia);
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

        const baseMensagem = {
          conversa_id: conversa.id,
          user_id: numero.user_id,
          wa_message_id: mensagem.id ?? null,
          direcao: "entrada",
          tipo: mensagem.type ?? "text",
          texto,
          status: "recebida",
          criado_em: quando,
        };
        let { error: mensagemError } = await chatDb.from("whatsapp_mensagens").insert({
          ...baseMensagem,
          media_id: midia?.id ?? null,
          media_mime: midia?.mime_type ?? null,
          media_nome: mensagem.document?.filename ?? null,
        });
        if (
          mensagemError &&
          (mensagemError.code === "42703" ||
            mensagemError.code === "PGRST204" ||
            /column .* does not exist|media_id/i.test(mensagemError.message ?? ""))
        ) {
          ({ error: mensagemError } = await chatDb.from("whatsapp_mensagens").insert(baseMensagem));
        }

        if (mensagemError) {
          if (mensagemError.code === "23505") continue;
          console.error("whatsapp webhook mensagem", mensagemError.message);
          continue;
        }

        await chatDb
          .from("whatsapp_conversas")
          .update({ nao_lidas: (conversa.nao_lidas ?? 0) + 1 })
          .eq("id", conversa.id);

        if (
          (mensagem.type === "text" || mensagem.type === "audio") &&
          mensagem.id &&
          numero.whatsapp_ai_agent_id
        ) {
          await responderComIa({
            userId: numero.user_id,
            conversationId: conversa.id,
            phoneNumberId,
            contactWaId: waId,
            inboundMessageId: mensagem.id,
            agentId: numero.whatsapp_ai_agent_id,
          });
        }
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
