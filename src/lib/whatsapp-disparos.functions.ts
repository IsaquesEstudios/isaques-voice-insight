import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const AVISO_TABELAS =
  "As tabelas de disparos ainda não existem no banco externo. Rode o SQL enviado no SQL Editor do seu Supabase externo.";

const tabelaAusente = (error: { code?: string | null; message?: string | null } | null) => {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "PGRST205" || msg.includes("schema cache") || msg.includes("does not exist");
};

const headerSchema = z
  .object({ tipo: z.enum(["image", "video", "document"]), link: z.string().url() })
  .nullable()
  .optional();

const campanhaSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome para a campanha.").max(120),
  phoneNumberId: z.string().min(1, "Escolha o número remetente."),
  templateName: z.string().min(1, "Escolha um modelo aprovado."),
  templateLang: z.string().min(2),
  header: headerSchema,
  agendadaPara: z.string().nullable().optional(),
  contatos: z
    .array(
      z.object({
        nome: z.string().trim().max(120).nullable().optional(),
        telefone: z.string().trim().min(8),
        variaveis: z.array(z.string()).default([]),
      }),
    )
    .min(1, "Envie ao menos um contato."),
});

export const listarCampanhasWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data, error } = await chatDb
      .from("whatsapp_campanhas")
      .select(
        "id, nome, phone_number_id, template_name, template_lang, status, agendada_para, total, enviados, falhas, erro, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (tabelaAusente(error)) return [];
    if (error) throw new Error(`Não foi possível carregar as campanhas: ${error.message}`);
    return data ?? [];
  });

export const listarContatosCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ campanhaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data: contatos, error } = await chatDb
      .from("whatsapp_campanha_contatos")
      .select("id, nome, telefone, status, erro, enviado_em")
      .eq("campanha_id", data.campanhaId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (tabelaAusente(error)) return [];
    if (error) throw new Error(error.message);
    return contatos ?? [];
  });

export const criarCampanhaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => campanhaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const agendada = data.agendadaPara ? new Date(data.agendadaPara).toISOString() : null;

    const { data: campanha, error } = await chatDb
      .from("whatsapp_campanhas")
      .insert({
        user_id: context.userId,
        nome: data.nome,
        phone_number_id: data.phoneNumberId,
        template_name: data.templateName,
        template_lang: data.templateLang,
        componentes: { header: data.header ?? null },
        status: agendada ? "agendada" : "enviando",
        agendada_para: agendada,
        total: data.contatos.length,
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    if (tabelaAusente(error)) throw new Error(AVISO_TABELAS);
    if (error || !campanha) throw new Error(error?.message ?? "Não foi possível criar a campanha.");

    const { error: contatosError } = await chatDb.from("whatsapp_campanha_contatos").insert(
      data.contatos.map((contato) => ({
        campanha_id: campanha.id,
        user_id: context.userId,
        nome: contato.nome ?? null,
        telefone: contato.telefone,
        variaveis: contato.variaveis,
        status: "pendente",
      })),
    );
    if (contatosError) throw new Error(contatosError.message);

    if (!agendada) {
      const { processarCampanha } = await import("@/lib/whatsapp-disparos.server");
      await processarCampanha(campanha.id);
    }
    return { ok: true as const, id: campanha.id };
  });

export const excluirCampanhaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    await chatDb
      .from("whatsapp_campanha_contatos")
      .delete()
      .eq("campanha_id", data.id)
      .eq("user_id", context.userId);
    const { error } = await chatDb
      .from("whatsapp_campanhas")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------ Lembretes ------------------------------ */

const lembreteSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(2, "Informe o nome do contato.").max(120),
  telefone: z.string().trim().min(8, "Informe o número."),
  phoneNumberId: z.string().min(1, "Escolha o número remetente."),
  templateName: z.string().min(1, "Escolha um modelo aprovado."),
  templateLang: z.string().min(2),
  variaveis: z.array(z.string()).default([]),
  header: headerSchema,
  agendadoPara: z.string().min(4, "Escolha data e hora."),
  recorrencia: z.enum(["unico", "diario", "semanal", "mensal"]).default("unico"),
});

export const listarLembretesWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data, error } = await chatDb
      .from("whatsapp_lembretes")
      .select(
        "id, nome, telefone, phone_number_id, template_name, template_lang, status, agendado_para, erro, enviado_em, created_at, componentes",
      )
      .eq("user_id", context.userId)
      .order("agendado_para", { ascending: true })
      .limit(200);
    if (tabelaAusente(error)) return [];
    if (error) throw new Error(`Não foi possível carregar os lembretes: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(({ componentes, ...resto }) => ({
      ...(resto as {
        id: string; nome: string; telefone: string; phone_number_id: string; template_name: string;
        template_lang: string; status: string; agendado_para: string; erro: string | null;
        enviado_em: string | null; created_at: string;
      }),
      recorrencia: ((componentes as { recorrencia?: string } | null)?.recorrencia ?? "unico") as string,
    }));
  });

export const salvarLembreteWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => lembreteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const registro = {
      user_id: context.userId,
      nome: data.nome,
      telefone: data.telefone,
      phone_number_id: data.phoneNumberId,
      template_name: data.templateName,
      template_lang: data.templateLang,
      variaveis: data.variaveis,
      componentes: { header: data.header ?? null, recorrencia: data.recorrencia },
      agendado_para: new Date(data.agendadoPara).toISOString(),
      status: "agendado",
      erro: null,
    };
    const query = data.id
      ? chatDb.from("whatsapp_lembretes").update(registro).eq("id", data.id).eq("user_id", context.userId)
      : chatDb.from("whatsapp_lembretes").insert(registro);
    const { error } = await query;
    if (tabelaAusente(error)) throw new Error(AVISO_TABELAS);
    if (error) throw new Error(`Não foi possível salvar o lembrete: ${error.message}`);
    return { ok: true as const };
  });

export const excluirLembreteWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { error } = await chatDb
      .from("whatsapp_lembretes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Continua manualmente uma campanha (útil quando o agendamento ainda não rodou). */
export const processarCampanhaAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data: campanha } = await chatDb
      .from("whatsapp_campanhas")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle<{ id: string }>();
    if (!campanha) throw new Error("Campanha não encontrada.");
    const { processarCampanha } = await import("@/lib/whatsapp-disparos.server");
    return processarCampanha(campanha.id);
  });

/** Devolve o endereço (com chave) que o agendamento do banco externo deve chamar. */
export const obterAgendamentoCron = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const segredo = process.env["DISPAROS_CRON_SECRET"] ?? "";
    const base = process.env["PUBLIC_APP_URL"] ?? "https://app.omniasyn.com";
    return { url: `${base}/api/public/cron/whatsapp-disparos?secret=${segredo}` };
  });
