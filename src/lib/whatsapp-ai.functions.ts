import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const agentSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  area: z.enum(["suporte", "vendas", "educacao"]),
  mission: z.string().trim().min(3, "Informe a missão.").max(500),
  tone: z.enum(["acolhedor", "formal", "descontraido", "tecnico"]),
  emojiUsage: z.enum(["nunca", "raramente", "frequente"]),
  responseLength: z.enum(["curtas", "medias", "detalhadas"]),
  restrictions: z.string().trim().max(3000),
  knowledge: z.string().trim().max(30000),
});

const tabelaAusente = (error: { code?: string | null; message?: string | null } | null) => {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "PGRST205" || msg.includes("schema cache") || msg.includes("does not exist");
};

const AVISO_TABELAS =
  "As tabelas de IA ainda não existem no banco externo. Rode o SQL enviado no SQL Editor do seu Supabase externo.";

export const listWhatsappAiAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data, error } = await chatDb
      .from("whatsapp_ai_agents")
      .select("id, name, provider, area, mission, tone, emoji_usage, language, response_length, restrictions, knowledge, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (tabelaAusente(error)) return [];
    if (error) throw new Error(`Não foi possível carregar os assistentes: ${error.message}`);
    return data ?? [];
  });

export const saveWhatsappAiAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => agentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const record = {
      user_id: context.userId,
      name: data.name,
      provider: "gemini",
      area: data.area,
      mission: data.mission,
      tone: data.tone,
      emoji_usage: data.emojiUsage,
      language: "pt-BR",
      response_length: data.responseLength,
      restrictions: data.restrictions,
      knowledge: data.knowledge,
    };
    const query = data.id
      ? chatDb.from("whatsapp_ai_agents").update(record).eq("id", data.id).eq("user_id", context.userId)
      : chatDb.from("whatsapp_ai_agents").insert(record);
    const { error } = await query;
    if (tabelaAusente(error)) throw new Error(AVISO_TABELAS);
    if (error) throw new Error(`Não foi possível salvar o assistente: ${error.message}`);
    return { ok: true as const };
  });

export const deleteWhatsappAiAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { error } = await chatDb
      .from("whatsapp_ai_agents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível excluir o assistente: ${error.message}`);
    return { ok: true as const };
  });

export const getGeminiCredentialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data, error } = await chatDb
      .from("whatsapp_ai_credentials")
      .select("gemini_api_key_last_four, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível consultar a chave: ${error.message}`);
    return {
      configured: Boolean(data),
      lastFour: data?.gemini_api_key_last_four ?? null,
      updatedAt: data?.updated_at ?? null,
    };
  });

export const saveGeminiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ apiKey: z.string().trim().min(20, "Informe uma chave Gemini válida.").max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const test = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": data.apiKey },
    });
    if (!test.ok) throw new Error("A chave Gemini não foi aceita. Confira a chave e tente novamente.");
    const { encryptApiKey } = await import("@/lib/whatsapp-ai.server");
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { error } = await chatDb.from("whatsapp_ai_credentials").upsert({
      user_id: context.userId,
      gemini_api_key_ciphertext: await encryptApiKey(data.apiKey),
      gemini_api_key_last_four: data.apiKey.slice(-4),
    });
    if (error) throw new Error(`Não foi possível guardar a chave: ${error.message}`);
    return { ok: true as const };
  });

export const deleteGeminiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { error } = await chatDb
      .from("whatsapp_ai_credentials")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível remover a chave: ${error.message}`);
    return { ok: true as const };
  });

export const bindWhatsappNumberAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ numberId: z.string().uuid(), agentId: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    if (data.agentId) {
      const { data: agent } = await chatDb
        .from("whatsapp_ai_agents")
        .select("id")
        .eq("id", data.agentId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!agent) throw new Error("Assistente não encontrado.");
    }
    const { error } = await supabaseAdmin
      .from("whatsapp_numeros")
      .update({ whatsapp_ai_agent_id: data.agentId })
      .eq("id", data.numberId)
      .eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível vincular o assistente: ${error.message}`);
    return { ok: true as const };
  });

export const setWhatsappConversationTakeover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid(), manual: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data: conversation } = await chatDb
      .from("whatsapp_conversas")
      .select("id")
      .eq("id", data.conversationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conversation) throw new Error("Conversa não encontrada.");
    const { error } = await chatDb.from("whatsapp_ai_conversation_controls").upsert({
      user_id: context.userId,
      conversation_id: data.conversationId,
      manual_takeover: data.manual,
    });
    if (error) throw new Error(`Não foi possível alterar o atendimento: ${error.message}`);
    return { ok: true as const };
  });