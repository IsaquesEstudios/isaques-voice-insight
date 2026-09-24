import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const GRAPH = "https://graph.facebook.com/v26.0";
const AVISO_SQL =
  "As tabelas de tags ainda não existem no banco externo. Rode o SQL de tags no SQL Editor.";

function tabelaAusente(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    /schema cache|does not exist/i.test(error?.message ?? "")
  );
}

async function db() {
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");
  return chatDb;
}

export type TagWhatsapp = { id: string; nome: string; cor: string | null };

const COR_PADRAO = "#00acdc";

function corValida(cor?: string | null) {
  const limpa = cor?.trim().toLowerCase() ?? "";
  return /^#[0-9a-f]{6}$/.test(limpa) ? limpa : COR_PADRAO;
}

/** Todas as tags do usuário e quais conversas usam cada uma. */
export const listarTagsWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const chatDb = await db();
    const [{ data: tags, error }, { data: vinculos, error: erroVinc }] = await Promise.all([
      chatDb.from("whatsapp_tags").select("id, nome, cor").eq("user_id", context.userId).order("nome"),
      chatDb.from("whatsapp_conversa_tags").select("conversa_id, tag_id").eq("user_id", context.userId),
    ]);
    if (error || erroVinc) {
      if (tabelaAusente(error ?? erroVinc)) return { tags: [], vinculos: [], aviso: AVISO_SQL };
      throw new Error((error ?? erroVinc)!.message);
    }
    return {
      tags: (tags ?? []) as TagWhatsapp[],
      vinculos: (vinculos ?? []) as { conversa_id: string; tag_id: string }[],
      aviso: null as string | null,
    };
  });

/** Cria a tag (ou reaproveita se já existir com o mesmo nome) e aplica na conversa. */
export const criarTagWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; cor?: string | null; conversaId?: string | null }) => {
    const nome = input?.nome?.trim().slice(0, 40);
    if (!nome) throw new Error("Dê um nome para a tag.");
    return { nome, cor: corValida(input.cor), conversaId: input.conversaId ?? null };
  })
  .handler(async ({ data, context }) => {
    const chatDb = await db();
    const { data: tag, error } = await chatDb
      .from("whatsapp_tags")
      .upsert(
        { user_id: context.userId, nome: data.nome, cor: data.cor },
        { onConflict: "user_id,nome" },
      )
      .select("id, nome, cor")
      .single<TagWhatsapp>();
    if (error) throw new Error(tabelaAusente(error) ? AVISO_SQL : error.message);
    if (data.conversaId) {
      const { error: e } = await chatDb
        .from("whatsapp_conversa_tags")
        .upsert(
          { conversa_id: data.conversaId, tag_id: tag.id, user_id: context.userId },
          { onConflict: "conversa_id,tag_id" },
        );
      if (e) throw new Error(e.message);
    }
    return tag;
  });

/** Liga ou desliga uma tag existente numa conversa. */
export const alternarTagConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversaId: string; tagId: string; ativo: boolean }) => {
    if (!input?.conversaId || !input?.tagId) throw new Error("Dados inválidos.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const chatDb = await db();
    const { data: conversa } = await chatDb
      .from("whatsapp_conversas")
      .select("id")
      .eq("id", data.conversaId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conversa) throw new Error("Conversa não encontrada.");
    const { error } = data.ativo
      ? await chatDb
          .from("whatsapp_conversa_tags")
          .upsert(
            { conversa_id: data.conversaId, tag_id: data.tagId, user_id: context.userId },
            { onConflict: "conversa_id,tag_id" },
          )
      : await chatDb
          .from("whatsapp_conversa_tags")
          .delete()
          .eq("conversa_id", data.conversaId)
          .eq("tag_id", data.tagId)
          .eq("user_id", context.userId);
    if (error) throw new Error(tabelaAusente(error) ? AVISO_SQL : error.message);
    return { ok: true };
  });

/** Exclui a conversa e tudo ligado a ela (mensagens, tags, controles da IA). */
export const excluirConversaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversaId: string }) => {
    if (!input?.conversaId) throw new Error("Conversa inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const chatDb = await db();
    const filtro = { user_id: context.userId };
    await chatDb.from("whatsapp_conversa_tags").delete().match({ ...filtro, conversa_id: data.conversaId });
    await chatDb
      .from("whatsapp_ai_conversation_controls")
      .delete()
      .match({ ...filtro, conversation_id: data.conversaId });
    await chatDb.from("whatsapp_ai_runs").delete().match({ ...filtro, conversation_id: data.conversaId });
    const { error: e1 } = await chatDb
      .from("whatsapp_mensagens")
      .delete()
      .match({ ...filtro, conversa_id: data.conversaId });
    if (e1) throw new Error(e1.message);
    const { error } = await chatDb
      .from("whatsapp_conversas")
      .delete()
      .match({ ...filtro, id: data.conversaId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- Envio em massa por tag ---------------------- */

type EnvioTag = {
  tagId: string;
  phoneNumberId: string;
  tipo: "text" | "audio" | "video" | "image";
  texto?: string | null;
  mimeType?: string | null;
  nomeArquivo?: string | null;
  dadosBase64?: string | null;
};

function base64ParaBytes(base64: string) {
  const limpo = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binario = atob(limpo);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export const enviarParaTagWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnvioTag) => {
    if (!input?.tagId || !input?.phoneNumberId) throw new Error("Escolha o número e a tag.");
    if (!["text", "audio", "video", "image"].includes(input.tipo)) throw new Error("Tipo inválido.");
    if (input.tipo === "text" && !input.texto?.trim()) throw new Error("Escreva a mensagem.");
    if (input.tipo !== "text" && !input.dadosBase64) throw new Error("Escolha o arquivo.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const chatDb = await db();

    const { data: numero } = await chatDb
      .from("whatsapp_numeros")
      .select("waba_id")
      .eq("phone_number_id", data.phoneNumberId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!numero) throw new Error("Número não encontrado.");
    const { data: conta } = await chatDb
      .from("whatsapp_accounts")
      .select("access_token")
      .eq("user_id", context.userId)
      .eq("waba_id", numero.waba_id)
      .maybeSingle();
    if (!conta?.access_token) throw new Error("A autorização da Meta expirou. Conecte o WhatsApp novamente.");
    const token = conta.access_token as string;

    const { data: vinculos, error: eV } = await chatDb
      .from("whatsapp_conversa_tags")
      .select("conversa_id")
      .eq("tag_id", data.tagId)
      .eq("user_id", context.userId);
    if (eV) throw new Error(tabelaAusente(eV) ? AVISO_SQL : eV.message);
    const ids = (vinculos ?? []).map((v) => v.conversa_id as string);
    if (ids.length === 0) throw new Error("Nenhuma conversa tem essa tag.");

    const { data: conversas } = await chatDb
      .from("whatsapp_conversas")
      .select("id, contato_wa_id")
      .in("id", ids)
      .eq("user_id", context.userId)
      .eq("phone_number_id", data.phoneNumberId)
      .limit(300);
    const destinos = (conversas ?? []) as { id: string; contato_wa_id: string }[];
    if (destinos.length === 0) throw new Error("Nenhuma conversa com essa tag neste número.");

    // Arquivo enviado uma única vez para a Meta e reaproveitado em todos os envios.
    let mediaId: string | null = null;
    if (data.tipo !== "text") {
      const bytes = base64ParaBytes(data.dadosBase64!);
      if (bytes.byteLength > 16 * 1024 * 1024) throw new Error("O arquivo passa do limite de 16 MB.");
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", data.mimeType ?? "application/octet-stream");
      form.append(
        "file",
        new Blob([bytes as unknown as BlobPart], { type: data.mimeType ?? "application/octet-stream" }),
        data.nomeArquivo ?? "arquivo",
      );
      const up = await fetch(`${GRAPH}/${data.phoneNumberId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const upJson = (await up.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
      if (!up.ok || !upJson.id) throw new Error(upJson.error?.message ?? "A Meta recusou o arquivo.");
      mediaId = upJson.id;
    }

    const legenda = data.texto?.trim() || null;
    const resumo =
      data.tipo === "text"
        ? legenda!
        : (legenda ?? (data.tipo === "audio" ? "🎤 Áudio" : data.tipo === "video" ? "🎬 Vídeo" : "📷 Foto"));

    let enviados = 0;
    let foraDaJanela = 0;
    const falhas: string[] = [];
    for (const destino of destinos) {
      const corpo: Record<string, unknown> =
        data.tipo === "text" ? { body: legenda } : { id: mediaId };
      if (data.tipo !== "text" && data.tipo !== "audio" && legenda) corpo["caption"] = legenda;
      const res = await fetch(`${GRAPH}/${data.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destino.contato_wa_id,
          type: data.tipo,
          [data.tipo]: corpo,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        messages?: { id?: string }[];
        error?: { message?: string; code?: number };
      };
      if (!res.ok) {
        if (json.error?.code === 131047) foraDaJanela += 1;
        else falhas.push(`${destino.contato_wa_id}: ${json.error?.message ?? "recusado"}`);
      } else {
        enviados += 1;
        const agora = new Date().toISOString();
        await chatDb.from("whatsapp_mensagens").insert({
          conversa_id: destino.id,
          user_id: context.userId,
          wa_message_id: json.messages?.[0]?.id ?? null,
          direcao: "saida",
          tipo: data.tipo,
          texto: resumo,
          status: "enviada",
          criado_em: agora,
          media_id: mediaId,
          media_mime: data.mimeType ?? null,
          media_nome: data.nomeArquivo ?? null,
        });
        await chatDb
          .from("whatsapp_conversas")
          .update({ ultima_mensagem: resumo, ultima_em: agora })
          .eq("id", destino.id);
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    return { total: destinos.length, enviados, foraDaJanela, falhas: falhas.slice(0, 10) };
  });
