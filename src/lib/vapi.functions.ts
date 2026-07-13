import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// --- Ownership helpers -----------------------------------------------------
// Assistants live in a single Vapi account, so per-user scoping is enforced
// via a Supabase table `user_assistants` that maps vapi_assistant_id -> user_id.
async function listOwnedIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_assistants")
    .select("vapi_assistant_id")
    .eq("user_id", userId);
  if (error) {
    console.error("user_assistants select error", error);
    throw new Error("Falha ao carregar assistentes do usuário.");
  }
  return new Set((data ?? []).map((r) => r.vapi_assistant_id as string));
}

async function assertOwnership(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_assistants")
    .select("vapi_assistant_id")
    .eq("user_id", userId)
    .eq("vapi_assistant_id", assistantId)
    .maybeSingle();
  if (error) {
    console.error("user_assistants ownership check error", error);
    throw new Error("Falha ao validar permissão.");
  }
  if (!data) {
    throw new Response("Forbidden: assistente não pertence ao usuário", {
      status: 403,
    });
  }
}

async function recordOwnership(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_assistants")
    .insert({ user_id: userId, vapi_assistant_id: assistantId });
  if (error) {
    console.error("user_assistants insert error", error);
    // Best-effort rollback: remove orphan assistant from Vapi.
    try {
      await vapiFetch(`/assistant/${assistantId}`, { method: "DELETE" });
    } catch (e) {
      console.error("orphan cleanup failed", e);
    }
    throw new Error("Falha ao vincular assistente ao usuário.");
  }
}

async function removeOwnership(
  supabase: SupabaseClient,
  userId: string,
  assistantId: string,
): Promise<void> {
  await supabase
    .from("user_assistants")
    .delete()
    .eq("user_id", userId)
    .eq("vapi_assistant_id", assistantId);
}


export interface VapiAssistantDTO {
  id: string;
  name?: string | null;
  voice?: { provider?: string; voiceId?: string } | null;
  model?: { provider?: string; model?: string } | null;
  firstMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Full raw shape used by the edit/duplicate flows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VapiAssistantRaw = Record<string, any> & { id: string };

export interface AssistantInput {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  modelProvider?: string;
  model?: string;
  voiceProvider?: string;
  voiceId?: string;
}

function getKey(): string {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("VAPI_PRIVATE_KEY não configurada no servidor");
  return key;
}

// Stack padrão de baixo custo enviada à Vapi em toda criação.
// Estes defaults refletem exatamente o que exibimos no painel de stats.
const DEFAULT_MODEL_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-5";
const DEFAULT_VOICE_PROVIDER = "cartesia";
const DEFAULT_VOICE_ID = "blake";
const DEFAULT_TRANSCRIBER_BLOCK = {
  provider: "deepgram",
  model: "nova-3",
} as const;

function buildPayload(input: AssistantInput) {
  return {
    name: input.name,
    firstMessage: input.firstMessage,
    transcriber: { ...DEFAULT_TRANSCRIBER_BLOCK },
    model: {
      provider: input.modelProvider?.trim() || DEFAULT_MODEL_PROVIDER,
      model: input.model?.trim() || DEFAULT_MODEL,
      messages: [{ role: "system", content: input.systemPrompt }],
    },
    voice: {
      provider: input.voiceProvider?.trim() || DEFAULT_VOICE_PROVIDER,
      voiceId: input.voiceId?.trim() || DEFAULT_VOICE_ID,
    },
  };
}

async function vapiFetch(path: string, init: RequestInit): Promise<unknown> {
  const maxAttempts = 3;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://api.vapi.ai${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.ok) {
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");
    // Retry on transient upstream failures (502/503/504); fail fast on 4xx.
    if (res.status < 500 || attempt === maxAttempts) break;
    await new Promise((r) => setTimeout(r, 300 * attempt));
  }
  console.error("Vapi API error", lastStatus, lastBody);
  throw new Error(
    lastStatus >= 500 && lastStatus < 600
      ? `A API da Vapi está temporariamente indisponível (${lastStatus}). Tente novamente em instantes.`
      : `Vapi ${init.method ?? "GET"} ${path} retornou ${lastStatus}`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeToolMessage(message: any): any {
  if (!message || typeof message !== "object") return message;
  const sanitized: Record<string, unknown> = { type: message.type };
  if (typeof message.content === "string") sanitized.content = message.content;
  if (Array.isArray(message.contents)) sanitized.contents = message.contents;
  if (Array.isArray(message.conditions)) sanitized.conditions = message.conditions;
  if (message.type === "request-start" && typeof message.blocking === "boolean") {
    sanitized.blocking = message.blocking;
  }
  if (
    (message.type === "request-complete" || message.type === "request-failed") &&
    typeof message.blocking === "boolean"
  ) {
    sanitized.endCallAfterSpokenEnabled = message.blocking;
  }
  return sanitized;
}

// Vapi's transient tools inside assistant.model.tools are strict. Some native
// dashboard controls expose display fields, but built-in tools reject them in
// the API payload (ex: endCall/transferCall reject top-level name/description).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeModelTool(tool: any): any {
  if (!tool || typeof tool !== "object") return tool;

  if (tool.type === "endCall") {
    return {
      type: "endCall",
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "transferCall") {
    return {
      type: "transferCall",
      ...(Array.isArray(tool.destinations) ? { destinations: tool.destinations } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "dtmf") {
    return {
      type: "dtmf",
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(typeof tool.sipInfoDtmfEnabled === "boolean"
        ? { sipInfoDtmfEnabled: tool.sipInfoDtmfEnabled }
        : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "voicemail") {
    // Vapi's voicemail built-in tool only accepts `type` and `messages` —
    // top-level `name`, `description`, and `metadata` are rejected.
    return {
      type: "voicemail",
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (tool.type === "sms") {
    // Vapi's sms built-in tool accepts `type`, `messages`, and `metadata`
    // (used for from/to/body config on the Twilio side). Strip top-level
    // `name`/`description` which are rejected on built-in tools.
    return {
      type: "sms",
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(tool.metadata && typeof tool.metadata === "object"
        ? { metadata: tool.metadata }
        : {}),
    };
  }

  if (tool.type === "sipRequest") {
    // Vapi's sipRequest only accepts: type, verb, headers, body, messages.
    // It rejects name/description/async/strict/parameters and uses `verb`
    // (not `sipVerb`).
    const verb = tool.verb ?? tool.sipVerb ?? "INFO";
    return {
      type: "sipRequest",
      verb,
      ...(tool.headers !== undefined ? { headers: tool.headers } : {}),
      ...(tool.body !== undefined ? { body: tool.body } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (tool.type === "handoff") {
    // Vapi's handoff tool accepts: type, destinations, messages, defaultResult,
    // function, rejectionPlan. Strip name/description/async/strict/parameters
    // which the dashboard UI keeps locally but are rejected server-side.
    return {
      type: "handoff",
      ...(Array.isArray(tool.destinations) ? { destinations: tool.destinations } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(typeof tool.defaultResult === "string" ? { defaultResult: tool.defaultResult } : {}),
      ...(tool.function ? { function: tool.function } : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "query") {
    // Vapi's query tool accepts: type, knowledgeBases, messages. Top-level
    // name/description are rejected (kept in UI state only).
    return {
      type: "query",
      ...(Array.isArray(tool.knowledgeBases) ? { knowledgeBases: tool.knowledgeBases } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "apiRequest") {
    // Vapi's apiRequest tool accepts top-level name/description/url/method,
    // plus headers (JsonSchema), body (JsonSchema), messages.
    return {
      type: "apiRequest",
      ...(typeof tool.name === "string" ? { name: tool.name } : {}),
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      ...(typeof tool.url === "string" ? { url: tool.url } : {}),
      ...(typeof tool.method === "string" ? { method: tool.method } : {}),
      ...(tool.headers !== undefined ? { headers: tool.headers } : {}),
      ...(tool.body !== undefined ? { body: tool.body } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "mcp") {
    // Vapi's mcp tool accepts: type, server (url/timeoutSeconds/headers),
    // protocol ("shttp" | "sse"), messages. Top-level name/description are
    // dashboard-only and stripped server-side.
    return {
      type: "mcp",
      ...(tool.server && typeof tool.server === "object" ? { server: tool.server } : {}),
      ...(typeof tool.protocol === "string" ? { protocol: tool.protocol } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (tool.type === "slack.message.send") {
    return {
      type: "slack.message.send",
      ...(typeof tool.name === "string" ? { name: tool.name } : {}),
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (tool.type === "google.sheets.row.append") {
    return {
      type: "google.sheets.row.append",
      ...(typeof tool.name === "string" ? { name: tool.name } : {}),
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      ...(typeof tool.spreadsheetId === "string" ? { spreadsheetId: tool.spreadsheetId } : {}),
      ...(typeof tool.range === "string" ? { range: tool.range } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (
    tool.type === "google.calendar.createEvent" ||
    tool.type === "google.calendar.checkAvailability"
  ) {
    return {
      type: tool.type,
      ...(typeof tool.name === "string" ? { name: tool.name } : {}),
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      ...(typeof tool.calendarId === "string" ? { calendarId: tool.calendarId } : {}),
      ...(typeof tool.timezone === "string" ? { timezone: tool.timezone } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (
    tool.type === "gohighlevel.calendar.event.create" ||
    tool.type === "gohighlevel.calendar.availability.check"
  ) {
    return {
      type: tool.type,
      ...(typeof tool.name === "string" ? { name: tool.name } : {}),
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      ...(typeof tool.calendarId === "string" ? { calendarId: tool.calendarId } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  if (
    tool.type === "gohighlevel.contact.create" ||
    tool.type === "gohighlevel.contact.get"
  ) {
    return {
      type: tool.type,
      ...(typeof tool.name === "string" ? { name: tool.name } : {}),
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
    };
  }

  return tool;
}

export const listVapiAssistants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VapiAssistantDTO[]> => {
    const owned = await listOwnedIds(context.supabase, context.userId);
    if (owned.size === 0) return [];
    const data = await vapiFetch("/assistant", { method: "GET" });
    if (!Array.isArray(data)) return [];
    return (data as VapiAssistantDTO[])
      .filter((a) => owned.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name ?? null,
        voice: a.voice
          ? { provider: a.voice.provider, voiceId: a.voice.voiceId }
          : null,
        model: a.model
          ? { provider: a.model.provider, model: a.model.model }
          : null,
        firstMessage: a.firstMessage ?? null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      }));
  });

export const getVapiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<VapiAssistantRaw> => {
    await assertOwnership(context.supabase, context.userId, data.id);
    const res = (await vapiFetch(`/assistant/${data.id}`, { method: "GET" })) as VapiAssistantRaw;
    return res;
  });

export const createVapiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AssistantInput) => {
    if (!input?.name?.trim()) throw new Error("Nome é obrigatório");
    return {
      name: input.name.trim(),
      firstMessage: input.firstMessage ?? "",
      systemPrompt: input.systemPrompt ?? "",
      modelProvider: input.modelProvider,
      model: input.model,
      voiceProvider: input.voiceProvider,
      voiceId: input.voiceId,
    };
  })
  .handler(async ({ data, context }): Promise<VapiAssistantRaw> => {
    const created = (await vapiFetch("/assistant", {
      method: "POST",
      body: JSON.stringify(buildPayload(data)),
    })) as VapiAssistantRaw;
    await recordOwnership(context.supabase, context.userId, created.id);
    return created;
  });

export const updateVapiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AssistantInput & { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    if (!input?.name?.trim()) throw new Error("Nome é obrigatório");
    return {
      id: input.id,
      name: input.name.trim(),
      firstMessage: input.firstMessage ?? "",
      systemPrompt: input.systemPrompt ?? "",
      modelProvider: input.modelProvider,
      model: input.model,
      voiceProvider: input.voiceProvider,
      voiceId: input.voiceId,
    };
  })
  .handler(async ({ data, context }): Promise<VapiAssistantRaw> => {
    await assertOwnership(context.supabase, context.userId, data.id);
    const { id, ...rest } = data;
    return (await vapiFetch(`/assistant/${id}`, {
      method: "PATCH",
      body: JSON.stringify(buildPayload(rest)),
    })) as VapiAssistantRaw;
  });

export interface AssistantConfigInput {
  id: string;
  name?: string;
  firstMessage?: string;
  systemPrompt?: string;
  modelProvider?: string;
  model?: string;
  voiceProvider?: string;
  voiceId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[];
}

// Partial PATCH used by the details page — only touches provided fields.
export const saveVapiAssistantConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AssistantConfigInput) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<VapiAssistantRaw> => {
    await assertOwnership(context.supabase, context.userId, data.id);
    const body: Record<string, unknown> = {};
    if (typeof data.name === "string") body.name = data.name.trim();
    if (typeof data.firstMessage === "string") body.firstMessage = data.firstMessage;

    // Tools live under model.tools on Vapi — if we're patching either the
    // model or the tools array we must send the merged model back whole.
    const needsModelPatch =
      Boolean(data.modelProvider) ||
      Boolean(data.model) ||
      typeof data.systemPrompt === "string" ||
      Array.isArray(data.tools);

    if (needsModelPatch) {
      const current = (await vapiFetch(`/assistant/${data.id}`, {
        method: "GET",
      })) as VapiAssistantRaw;
      const currentModel = (current?.model ?? {}) as Record<string, unknown>;
      const model: Record<string, unknown> = { ...currentModel };
      if (data.modelProvider) model.provider = data.modelProvider;
      if (data.model) model.model = data.model;
      if (typeof data.systemPrompt === "string") {
        model.messages = [{ role: "system", content: data.systemPrompt }];
      }
      if (Array.isArray(data.tools)) model.tools = data.tools.map(sanitizeModelTool);
      body.model = model;
    }

    if (data.voiceProvider || data.voiceId) {
      body.voice = {
        ...(data.voiceProvider ? { provider: data.voiceProvider } : {}),
        ...(data.voiceId ? { voiceId: data.voiceId } : {}),
      };
    }
    return (await vapiFetch(`/assistant/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })) as VapiAssistantRaw;
  });

export const deleteVapiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOwnership(context.supabase, context.userId, data.id);
    await vapiFetch(`/assistant/${data.id}`, { method: "DELETE" });
    await removeOwnership(context.supabase, context.userId, data.id);
    return { ok: true };
  });

// Duplicates an existing assistant by fetching its full config, stripping
// server-managed fields, and creating a new one with " - Cópia" appended.
export const duplicateVapiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<VapiAssistantRaw> => {
    await assertOwnership(context.supabase, context.userId, data.id);
    const source = (await vapiFetch(`/assistant/${data.id}`, {
      method: "GET",
    })) as VapiAssistantRaw;

    const clone: Record<string, unknown> = { ...source };
    // Strip server-managed / immutable fields that Vapi rejects on POST.
    for (const key of [
      "id",
      "orgId",
      "createdAt",
      "updatedAt",
      "isServerUrlSecretSet",
    ]) {
      delete clone[key];
    }
    const baseName =
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim()
        : "Assistente Sem Nome";
    clone.name = `${baseName} - Cópia`;

    const created = (await vapiFetch("/assistant", {
      method: "POST",
      body: JSON.stringify(clone),
    })) as VapiAssistantRaw;
    await recordOwnership(context.supabase, context.userId, created.id);
    return created;
  });

