import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const GRAPH = "https://graph.facebook.com/v26.0";

const botaoSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().trim().min(1).max(25) }),
  z.object({
    type: z.literal("URL"),
    text: z.string().trim().min(1).max(25),
    url: z.string().trim().min(4).max(2000),
    example: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().trim().min(1).max(25),
    phone_number: z.string().trim().min(5).max(20),
  }),
  z.object({ type: z.literal("COPY_CODE"), example: z.string().trim().min(1).max(15) }),
]);

const templateSchema = z.object({
  wabaId: z.string().min(1),
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "Use apenas letras minúsculas, números e underline."),
  language: z.string().trim().min(2),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  headerTipo: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]),
  headerTexto: z.string().trim().max(60).optional(),
  headerExemplo: z.string().trim().optional(),
  headerHandle: z.string().trim().optional(),
  body: z.string().trim().min(1, "Escreva o corpo da mensagem.").max(1024),
  bodyExemplos: z.array(z.string().trim()).default([]),
  footer: z.string().trim().max(60).optional(),
  botoes: z.array(botaoSchema).max(10).default([]),
});

export type TemplateInput = z.infer<typeof templateSchema>;

async function tokenDaConta(userId: string, wabaId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_accounts")
    .select("access_token")
    .eq("user_id", userId)
    .eq("waba_id", wabaId)
    .maybeSingle();
  if (!data?.access_token) {
    throw new Error("A autorização da Meta expirou. Conecte o WhatsApp novamente.");
  }
  return data.access_token;
}

function contarVariaveis(texto: string) {
  return (texto.match(/\{\{\s*\d+\s*\}\}/g) ?? []).length;
}

export type ComponenteTemplate = {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text?: string; url?: string; phone_number?: string }[];
};

export const listarTemplatesWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contas } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("waba_id, access_token")
      .eq("user_id", context.userId);

    const resultado: {
      wabaId: string;
      id: string;
      name: string;
      language: string;
      category: string;
      status: string;
      motivo: string | null;
      components: ComponenteTemplate[];
    }[] = [];

    for (const conta of contas ?? []) {
      if (!conta.access_token) continue;
      const res = await fetch(
        `${GRAPH}/${conta.waba_id}/message_templates?limit=200&fields=id,name,language,category,status,rejected_reason,components`,
        { headers: { Authorization: `Bearer ${conta.access_token}` } },
      );
      const json = (await res.json()) as {
        data?: {
          id: string;
          name: string;
          language: string;
          category: string;
          status: string;
          rejected_reason?: string;
          components?: ComponenteTemplate[];
        }[];
      };
      if (!res.ok) continue;
      for (const t of json.data ?? []) {
        resultado.push({
          wabaId: conta.waba_id,
          id: t.id,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          motivo: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
          components: t.components ?? [],
        });
      }
    }
    return resultado;
  });

/** Sobe um arquivo para virar cabeçalho de mídia do template (upload retomável da Meta). */
export const enviarArquivoTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; mimeType: string; dadosBase64: string }) => {
    if (!input?.dadosBase64) throw new Error("Arquivo inválido.");
    return input;
  })
  .handler(async ({ data }) => {
    const appId = process.env["META_APP_ID"];
    const appSecret = process.env["META_APP_SECRET"];
    if (!appId || !appSecret) throw new Error("Integração da Meta não configurada.");
    const appToken = `${appId}|${appSecret}`;

    const limpo = data.dadosBase64.includes(",")
      ? data.dadosBase64.slice(data.dadosBase64.indexOf(",") + 1)
      : data.dadosBase64;
    const binario = atob(limpo);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);

    const sessaoRes = await fetch(
      `${GRAPH}/${appId}/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(
        data.mimeType,
      )}&access_token=${encodeURIComponent(appToken)}`,
      { method: "POST" },
    );
    const sessaoJson = (await sessaoRes.json()) as { id?: string; error?: { message?: string } };
    if (!sessaoRes.ok || !sessaoJson.id) {
      throw new Error(sessaoJson.error?.message ?? "Não foi possível iniciar o envio do arquivo.");
    }

    const uploadRes = await fetch(`${GRAPH}/${sessaoJson.id}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${appToken}`, file_offset: "0" },
      body: bytes,
    });
    const uploadJson = (await uploadRes.json()) as { h?: string; error?: { message?: string } };
    if (!uploadRes.ok || !uploadJson.h) {
      throw new Error(uploadJson.error?.message ?? "Não foi possível enviar o arquivo.");
    }
    return { handle: uploadJson.h };
  });

export const criarTemplateWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => templateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const token = await tokenDaConta(context.userId, data.wabaId);

    const variaveis = contarVariaveis(data.body);
    if (variaveis > 0 && data.bodyExemplos.filter(Boolean).length < variaveis) {
      throw new Error("Preencha um exemplo para cada variável do corpo da mensagem.");
    }

    const components: Record<string, unknown>[] = [];

    if (data.headerTipo === "TEXT" && data.headerTexto) {
      const header: Record<string, unknown> = {
        type: "HEADER",
        format: "TEXT",
        text: data.headerTexto,
      };
      if (contarVariaveis(data.headerTexto) > 0) {
        if (!data.headerExemplo) throw new Error("Informe um exemplo para a variável do título.");
        header["example"] = { header_text: [data.headerExemplo] };
      }
      components.push(header);
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(data.headerTipo)) {
      if (!data.headerHandle) throw new Error("Envie o arquivo de exemplo do título.");
      components.push({
        type: "HEADER",
        format: data.headerTipo,
        example: { header_handle: [data.headerHandle] },
      });
    } else if (data.headerTipo === "LOCATION") {
      components.push({ type: "HEADER", format: "LOCATION" });
    }

    const body: Record<string, unknown> = { type: "BODY", text: data.body };
    if (variaveis > 0) {
      body["example"] = { body_text: [data.bodyExemplos.slice(0, variaveis)] };
    }
    components.push(body);

    if (data.footer) components.push({ type: "FOOTER", text: data.footer });
    if (data.botoes.length > 0) components.push({ type: "BUTTONS", buttons: data.botoes });

    const res = await fetch(`${GRAPH}/${data.wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        language: data.language,
        category: data.category,
        components,
      }),
    });
    const json = (await res.json()) as {
      id?: string;
      status?: string;
      error?: { message?: string; error_user_msg?: string; code?: number };
    };
    if (!res.ok) {
      const msg =
        json.error?.error_user_msg ?? json.error?.message ?? "A Meta recusou a criação do modelo.";
      throw new Error(msg);
    }
    return { ok: true as const, id: json.id ?? null, status: json.status ?? "PENDING" };
  });

export const excluirTemplateWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ wabaId: z.string().min(1), name: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = await tokenDaConta(context.userId, data.wabaId);
    const res = await fetch(
      `${GRAPH}/${data.wabaId}/message_templates?name=${encodeURIComponent(data.name)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível excluir o modelo.");
    return { ok: true as const };
  });
