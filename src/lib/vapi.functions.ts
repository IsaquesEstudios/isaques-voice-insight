import { createServerFn, createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// AsyncLocalStorage carrega a chave Vapi do usuário durante toda a execução
// do handler, para que `vapiFetch` (helper compartilhado) consiga usá-la sem
// receber o valor por parâmetro em cada chamada.
const vapiKeyStore = new AsyncLocalStorage<string>();

async function loadUserVapiKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_vapi_credentials")
    .select("private_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar chave Vapi: ${error.message}`);
  return (data?.private_key as string | undefined) ?? null;
}

async function loadUserVapiPublicKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_vapi_credentials")
    .select("public_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  const v = (data?.public_key as string | undefined) ?? null;
  return v && v.trim() ? v.trim() : null;
}

// Middleware: exige auth + Vapi configurada e injeta a chave via ALS.
export const withVapiCredentials = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const key = await loadUserVapiKey(context.supabase, context.userId);
    if (!key) {
      throw new Response(
        JSON.stringify({
          code: "VAPI_NOT_CONFIGURED",
          message: "Configure sua chave Vapi em /onboarding antes de usar assistentes.",
        }),
        { status: 428, headers: { "Content-Type": "application/json" } },
      );
    }
    return vapiKeyStore.run(key, () => next());
  });

// --- Ownership helpers -----------------------------------------------------
// Cada usuário usa a própria API key da Vapi, então a lista de assistentes
// já é naturalmente escopada por conta/organização Vapi. Não filtramos mais
// pelo banco `user_assistants` — o que existe na Vapi é o que aparece.


async function assertOwnership(
  _supabase: SupabaseClient,
  _userId: string,
  _assistantId: string,
): Promise<void> {
  // No-op: a API key da Vapi do usuário já isola a organização dele.
}

async function recordOwnership(
  _supabase: SupabaseClient,
  _userId: string,
  _assistantId: string,
): Promise<void> {
  // No-op: mantido para não quebrar chamadas existentes.
}

async function removeOwnership(
  _supabase: SupabaseClient,
  _userId: string,
  _assistantId: string,
): Promise<void> {
  // No-op.
}



export interface VapiAssistantDTO {
  id: string;
  name?: string | null;
  voice?: { provider?: string; voiceId?: string } | null;
  model?: { provider?: string; model?: string } | null;
  firstMessage?: string | null;
  firstMessageMode?: string | null;
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
  const key = vapiKeyStore.getStore();
  if (!key) throw new Error("Chave Vapi ausente no contexto da requisição.");
  return key;
}

// Stack padrão oficialmente recomendada pela Vapi.
// Ref.: https://github.com/vapiai/skills/blob/HEAD/create-assistant/references/providers.md
const DEFAULT_MODEL_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4.1";
const DEFAULT_VOICE_PROVIDER = "vapi";
const DEFAULT_VOICE_ID = "Elliot";
const DEFAULT_VOICE_VERSION = 2;
const DEFAULT_TRANSCRIBER_BLOCK = {
  provider: "deepgram",
  model: "nova-3",
  language: "multi",
} as const;

// Faz com que o resumo da chamada seja gerado no MESMO idioma da transcrição.
// A Vapi por padrão sempre responde em inglês; forçamos o comportamento via
// prompt customizado no summaryPlan (documentado em Vapi > Analysis).
const ANALYSIS_PLAN_SAME_LANGUAGE = {
  summaryPlan: {
    enabled: true,
    messages: [
      {
        role: "system",
        content:
          "You are an expert note-taker. You will be given a transcript of a call. Summarize the call in 2-3 sentences. DO NOT return anything except the summary. CRITICAL: Write the summary in the EXACT SAME LANGUAGE spoken in the transcript. If the conversation is in Portuguese, respond in Portuguese. If in Spanish, respond in Spanish. If in English, respond in English. Never translate.",
      },
      {
        role: "user",
        content:
          "Here is the transcript:\n\n{{transcript}}\n\nWrite the summary now, in the same language as the transcript:",
      },
    ],
  },
} as const;

function buildPayload(input: AssistantInput) {
  const voiceProvider = input.voiceProvider?.trim() || DEFAULT_VOICE_PROVIDER;
  const voiceId = input.voiceId?.trim() || DEFAULT_VOICE_ID;
  const voice: Record<string, unknown> = { provider: voiceProvider, voiceId };
  // A Vapi só aceita "version" quando o provider é "vapi".
  if (voiceProvider === "vapi" && voiceId === DEFAULT_VOICE_ID) {
    voice.version = DEFAULT_VOICE_VERSION;
  }
  return {
    name: input.name,
    firstMessage: input.firstMessage,
    firstMessageMode: input.firstMessage?.trim()
      ? "assistant-speaks-first"
      : "assistant-speaks-first-with-model-generated-message",
    transcriber: { ...DEFAULT_TRANSCRIBER_BLOCK },
    model: {
      provider: input.modelProvider?.trim() || DEFAULT_MODEL_PROVIDER,
      model:
        input.model?.trim() === "gpt-4o-realtime-preview"
          ? "gpt-4o-realtime-preview-2024-12-17"
          : input.model?.trim() === "gpt-4o-mini-realtime-preview"
            ? "gpt-4o-mini-realtime-preview-2024-12-17"
            : input.model?.trim() === "gpt-4o"
              ? "chatgpt-4o-latest"
              : input.model?.trim() || DEFAULT_MODEL,
      messages: [{ role: "system", content: input.systemPrompt }],
    },
    voice,
    analysisPlan: { ...ANALYSIS_PLAN_SAME_LANGUAGE },
  };
}


async function vapiFetchWithKey(
  key: string,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const maxAttempts = 3;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://api.vapi.ai${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
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
  const rawMessage = (() => {
    try {
      const parsed = JSON.parse(lastBody) as { message?: unknown; error?: unknown };
      if (Array.isArray(parsed.message)) return parsed.message.join(" ");
      if (typeof parsed.message === "string") return parsed.message;
      if (typeof parsed.error === "string") return parsed.error;
    } catch {
      // keep raw body below
    }
    return lastBody?.slice(0, 500) ?? "";
  })();
  if (/couldn'?t find 11labs voice/i.test(rawMessage)) {
    throw new Error(
      "Voz ElevenLabs não encontrada. A voz selecionada não existe na conta/lista ElevenLabs conectada à Vapi. Selecione uma voz brasileira carregada no dropdown ou ajuste/remova as credenciais ElevenLabs dentro da Vapi. " +
        `Detalhe técnico: ${rawMessage}`,
    );
  }
  throw new Error(
    lastStatus >= 500 && lastStatus < 600
      ? `A API da Vapi está temporariamente indisponível (${lastStatus}). Tente novamente em instantes.`
      : `Vapi ${init.method ?? "GET"} ${path} retornou ${lastStatus}: ${rawMessage}`,
  );
}

async function vapiFetch(path: string, init: RequestInit): Promise<unknown> {
  return vapiFetchWithKey(getKey(), path, init);
}

async function createScopedWebCallPublicToken(
  assistantId: string,
): Promise<{ id: string | null; value: string }> {
  const token = (await vapiFetch("/token", {
    method: "POST",
    body: JSON.stringify({
      tag: "public",
      name: `web-${assistantId.slice(0, 8)}-${Date.now().toString(36)}`.slice(0, 40),
      restrictions: {
        allowedAssistantIds: [assistantId],
        allowTransientAssistant: false,
      },
    }),
  })) as { id?: string; value?: string } | null;

  if (!token?.value) {
    throw new Error(
      "A Vapi criou o token público para chamada web, mas não retornou a chave. Tente novamente em instantes.",
    );
  }

  return { id: token.id ?? null, value: token.value };
}

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

function shouldRetryWebCallWithScopedToken(error: unknown): boolean {
  const msg = getErrorText(error).toLowerCase();
  return (
    msg.includes("couldn't get assistant") ||
    msg.includes("couldn’t get assistant") ||
    msg.includes("does not exist") ||
    msg.includes("not found") ||
    msg.includes("invalid key") ||
    msg.includes("unauthorized") ||
    msg.includes("public key") ||
    msg.includes("api key")
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

// A transferCall destination carries the routing target plus the fields the
// LLM uses to decide *when* to transfer (`description`), what it says to the
// caller right before transferring (`message`), and how the handoff happens
// (`transferPlan`). Passing the array through raw dropped these, so the model
// had no trigger condition and never fired the tool on its own.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeTransferDestination(destination: any): any {
  if (!destination || typeof destination !== "object") return destination;
  const isSip = destination.type === "sip";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any = isSip
    ? { type: "sip", sipUri: destination.sipUri }
    : { type: "number", number: destination.number };

  if (!isSip && typeof destination.numberE164CheckEnabled === "boolean") {
    out.numberE164CheckEnabled = destination.numberE164CheckEnabled;
  }
  if (typeof destination.extension === "string" && destination.extension.trim()) {
    out.extension = destination.extension.trim();
  }
  if (typeof destination.description === "string" && destination.description.trim()) {
    out.description = destination.description.trim();
  }
  if (typeof destination.message === "string" && destination.message.trim()) {
    out.message = destination.message.trim();
  }
  if (destination.transferPlan && typeof destination.transferPlan === "object") {
    const mode = destination.transferPlan.mode;
    if (typeof mode === "string" && mode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan: any = { mode };
      const planMessage = destination.transferPlan.message;
      const needsMessage =
        mode === "warm-transfer-say-message" ||
        mode === "warm-transfer-wait-for-operator-to-speak-first-and-then-say-message";
      if (needsMessage && typeof planMessage === "string" && planMessage.trim()) {
        plan.message = planMessage.trim();
      }
      if (
        mode === "warm-transfer-say-summary" ||
        mode === "blind-transfer-add-summary-to-sip-header"
      ) {
        const summaryPlan = destination.transferPlan.summaryPlan;
        if (summaryPlan && typeof summaryPlan === "object") plan.summaryPlan = summaryPlan;
      }
      // Em transferências diretas o tronco decide o método: `refer` devolve a
      // ligação para a operadora (troncos que recusam REFER derrubam a chamada
      // no momento da transferência) e `dial` mantém a ligação na Vapi.
      if (mode.startsWith("blind-transfer")) {
        const verb = destination.transferPlan.sipVerb;
        plan.sipVerb = verb === "refer" || verb === "bye" ? verb : "dial";
      }
      out.transferPlan = plan;
    }
  }
  return out;
}


// Vapi's transient tools inside assistant.model.tools are strict. Some native
// dashboard controls expose display fields, but built-in tools reject them in
// the API payload (ex: endCall/transferCall reject top-level name/description).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeModelTool(tool: any): any {
  if (!tool || typeof tool !== "object") return tool;

  if (tool.type === "endCall") {
    // Vapi rejects top-level name/description on built-in tools, but accepts an
    // OpenAI-style `function` block — that's how the LLM learns when to hang up.
    const fnName =
      typeof tool.function?.name === "string" && tool.function.name.trim()
        ? tool.function.name.trim()
        : typeof tool.name === "string" && tool.name.trim()
          ? tool.name.trim()
          : "";
    const fnDescription =
      typeof tool.function?.description === "string" && tool.function.description.trim()
        ? tool.function.description.trim()
        : typeof tool.description === "string" && tool.description.trim()
          ? tool.description.trim()
          : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn: any = {};
    if (fnName) fn.name = fnName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    if (fnDescription) fn.description = fnDescription.slice(0, 1000);
    return {
      type: "endCall",
      ...(Object.keys(fn).length > 0 ? { function: fn } : {}),
      ...(Array.isArray(tool.messages) && tool.messages.length > 0
        ? { messages: tool.messages.map(sanitizeToolMessage) }
        : {}),
      ...(tool.rejectionPlan ? { rejectionPlan: tool.rejectionPlan } : {}),
    };
  }

  if (tool.type === "transferCall") {
    return {
      type: "transferCall",
      ...(Array.isArray(tool.destinations)
        ? { destinations: tool.destinations.map(sanitizeTransferDestination) }
        : {}),
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
    // (used for from/to/body config on the provider side). Strip top-level
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
      ...(tool.variableExtractionPlan !== undefined
        ? { variableExtractionPlan: tool.variableExtractionPlan }
        : {}),
      ...(typeof tool.timeoutSeconds === "number" ? { timeoutSeconds: tool.timeoutSeconds } : {}),
      ...(tool.backoffPlan !== undefined ? { backoffPlan: tool.backoffPlan } : {}),
      ...(typeof tool.credentialId === "string" ? { credentialId: tool.credentialId } : {}),

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
  .middleware([withVapiCredentials])
  .handler(async (): Promise<VapiAssistantDTO[]> => {
    const data = await vapiFetch("/assistant", { method: "GET" });
    if (!Array.isArray(data)) return [];
    return (data as VapiAssistantDTO[]).map((a) => ({
      id: a.id,
      name: a.name ?? null,
      voice: a.voice
        ? { provider: a.voice.provider, voiceId: a.voice.voiceId }
        : null,
      model: a.model
        ? { provider: a.model.provider, model: a.model.model }
        : null,
      firstMessage: a.firstMessage ?? null,
      firstMessageMode: a.firstMessageMode ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  });


export const getVapiAssistant = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
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
  .middleware([withVapiCredentials])
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
  .middleware([withVapiCredentials])
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
  // ---- Voice tuning (provider-specific + generic) ----
  voiceModel?: string | null; // ElevenLabs model (eleven_multilingual_v2, ...)
  voiceStability?: number | null; // 0..1 (11labs)
  voiceSimilarityBoost?: number | null; // 0..1 (11labs)
  voiceStyle?: number | null; // 0..1 (11labs)
  voiceUseSpeakerBoost?: boolean | null; // 11labs
  voiceSpeed?: number | null; // 0.25..4 (11labs/openai/cartesia/playht)
  voiceEmotion?: string | null; // cartesia/playht
  voiceTemperature?: number | null; // playht 0..2
  voiceFillerInjectionEnabled?: boolean | null;
  // ---- Speaking plan ----
  startWaitSeconds?: number | null;
  smartEndpointingEnabled?: boolean | null;
  stopNumWords?: number | null;
  stopVoiceSeconds?: number | null;
  stopBackoffSeconds?: number | null;
  // ---- Background ----
  backgroundSound?: "off" | "office" | null;
  backgroundDenoisingEnabled?: boolean | null;
  // ---- Transcriber (opcional; sobrepõe o default Deepgram Nova 3 multi) ----
  transcriberProvider?: string | null;
  transcriberModel?: string | null;
  transcriberLanguage?: string | null;
}

// Partial PATCH used by the details page — only touches provided fields.
export const saveVapiAssistantConfig = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: AssistantConfigInput) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<VapiAssistantRaw> => {
    await assertOwnership(context.supabase, context.userId, data.id);
    const body: Record<string, unknown> = {};
    if (typeof data.name === "string") body.name = data.name.trim();
    if (typeof data.firstMessage === "string") {
      body.firstMessage = data.firstMessage;
      body.firstMessageMode = data.firstMessage.trim()
        ? "assistant-speaks-first"
        : "assistant-speaks-first-with-model-generated-message";
    }

    // Tools live under model.tools on Vapi — if we're patching either the
    // model or the tools array we must send the merged model back whole.
    const needsModelPatch =
      Boolean(data.modelProvider) ||
      Boolean(data.model) ||
      typeof data.systemPrompt === "string" ||
      Array.isArray(data.tools);

    // Transcriber: usa override se enviado, senão padrão Deepgram Nova 3 multi.
    if (data.transcriberProvider && data.transcriberModel) {
      const t: Record<string, unknown> = {
        provider: data.transcriberProvider,
      };
      // Vapi's own transcriber provider ("vapi") doesn't accept a `model` field.
      if (data.transcriberProvider !== "vapi") {
        t.model = data.transcriberModel;
      }
      if (data.transcriberLanguage) t.language = data.transcriberLanguage;
      body.transcriber = t;
    } else {
      body.transcriber = { ...DEFAULT_TRANSCRIBER_BLOCK };
    }

    if (needsModelPatch) {
      const current = (await vapiFetch(`/assistant/${data.id}`, {
        method: "GET",
      })) as VapiAssistantRaw;
      const currentModel = (current?.model ?? {}) as Record<string, unknown>;
      const model: Record<string, unknown> = { ...currentModel };
      if (data.modelProvider) model.provider = data.modelProvider;
      if (data.model) {
        const normalizedModel =
          data.model === "gpt-4o-realtime-preview"
            ? "gpt-4o-realtime-preview-2024-12-17"
            : data.model === "gpt-4o-mini-realtime-preview"
              ? "gpt-4o-mini-realtime-preview-2024-12-17"
              : data.model === "gpt-4o"
                ? "chatgpt-4o-latest"
                : data.model;
        model.model = normalizedModel;
      }
      if (typeof data.systemPrompt === "string") {
        model.messages = [{ role: "system", content: data.systemPrompt }];
      }
      if (Array.isArray(data.tools)) model.tools = data.tools.map(sanitizeModelTool);
      body.model = model;
    }

    // ----- voice block -----
    // Cada provedor da Vapi aceita apenas um subconjunto de propriedades no
    // objeto `voice`. Enviar chaves fora desse conjunto → 400 (ex.:
    // "voice.property speed should not exist" em 11labs). Portanto filtramos
    // por provider antes de mandar o PATCH.
    const provider = (data.voiceProvider ?? "").toLowerCase();
    const supports = {
      speed: ["cartesia", "playht", "openai", "azure", "deepgram", "rime-ai"].includes(provider),
      emotion: ["cartesia", "playht"].includes(provider),
      temperature: provider === "playht",
      elevenTuning: provider === "11labs",
      model: provider === "11labs",
      fillerInjection: provider === "11labs",
    };

    const voicePatch: Record<string, unknown> = {};
    if (data.voiceProvider) voicePatch.provider = data.voiceProvider;
    if (data.voiceId) voicePatch.voiceId = data.voiceId;
    if (supports.model && data.voiceModel != null && data.voiceModel !== "")
      voicePatch.model = data.voiceModel;
    if (supports.speed && typeof data.voiceSpeed === "number")
      voicePatch.speed = data.voiceSpeed;
    if (supports.emotion && typeof data.voiceEmotion === "string" && data.voiceEmotion)
      voicePatch.emotion = data.voiceEmotion;
    if (supports.temperature && typeof data.voiceTemperature === "number")
      voicePatch.temperature = data.voiceTemperature;
    if (supports.fillerInjection && typeof data.voiceFillerInjectionEnabled === "boolean")
      voicePatch.fillerInjectionEnabled = data.voiceFillerInjectionEnabled;
    if (supports.elevenTuning) {
      if (typeof data.voiceStability === "number")
        voicePatch.stability = data.voiceStability;
      if (typeof data.voiceSimilarityBoost === "number")
        voicePatch.similarityBoost = data.voiceSimilarityBoost;
      if (typeof data.voiceStyle === "number") voicePatch.style = data.voiceStyle;
      if (typeof data.voiceUseSpeakerBoost === "boolean")
        voicePatch.useSpeakerBoost = data.voiceUseSpeakerBoost;
    }

    if (Object.keys(voicePatch).length > 0) body.voice = voicePatch;


    // ----- speaking plans -----
    const startPlan: Record<string, unknown> = {};
    if (typeof data.startWaitSeconds === "number")
      startPlan.waitSeconds = data.startWaitSeconds;
    if (typeof data.smartEndpointingEnabled === "boolean")
      startPlan.smartEndpointingEnabled = data.smartEndpointingEnabled;
    if (Object.keys(startPlan).length > 0) body.startSpeakingPlan = startPlan;

    const stopPlan: Record<string, unknown> = {};
    if (typeof data.stopNumWords === "number") stopPlan.numWords = data.stopNumWords;
    if (typeof data.stopVoiceSeconds === "number")
      stopPlan.voiceSeconds = data.stopVoiceSeconds;
    if (typeof data.stopBackoffSeconds === "number")
      stopPlan.backoffSeconds = data.stopBackoffSeconds;
    if (Object.keys(stopPlan).length > 0) body.stopSpeakingPlan = stopPlan;

    // ----- background -----
    if (data.backgroundSound === "off" || data.backgroundSound === "office")
      body.backgroundSound = data.backgroundSound;
    if (typeof data.backgroundDenoisingEnabled === "boolean")
      body.backgroundDenoisingEnabled = data.backgroundDenoisingEnabled;

    // Garante que o resumo pós-chamada seja gerado no mesmo idioma da conversa.
    body.analysisPlan = { ...ANALYSIS_PLAN_SAME_LANGUAGE };

    return (await vapiFetch(`/assistant/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })) as VapiAssistantRaw;
  });


export const deleteVapiAssistant = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
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
  .middleware([withVapiCredentials])
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

// ---------- Phone-number ↔ Assistant linking -----------------------------

export interface VapiPhoneNumberDTO {
  id: string;
  provider: string;
  number?: string | null;
  name?: string | null;
  assistantId?: string | null;
}

type AttachAssistantResult =
  | { ok: true; vapiNumberId: string; assistantId: string }
  | { ok: false; reason: "already_in_use" | "sip_not_connected"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VapiPhoneNumberRaw = Record<string, any> & { id: string };

/* ---------------- Tronco SIP do usuário (BYO SIP Trunk) ---------------- */

type SipTrunk = {
  sipHost: string;
  sipUsername: string;
  sipPassword: string;
  vapiCredentialId: string | null;
};

async function loadSipTrunk(
  supabase: SupabaseClient,
  userId: string,
): Promise<SipTrunk | null> {
  const { data, error } = await supabase
    .from("user_nvoip_credentials")
    .select("sip_host, sip_username, sip_password, vapi_credential_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!data.sip_host || !data.sip_username) return null;
  return {
    sipHost: data.sip_host as string,
    sipUsername: data.sip_username as string,
    sipPassword: data.sip_password as string,
    vapiCredentialId: (data.vapi_credential_id as string | null) ?? null,
  };
}

// Cria (ou reaproveita) a credencial `byo-sip-trunk` da Vapi apontando para o
// tronco SIP informado pelo usuário — caminho oficial da Vapi para operadoras
// externas.
async function ensureSipCredentialId(
  supabase: SupabaseClient,
  userId: string,
  trunk: SipTrunk,
): Promise<string> {
  if (trunk.vapiCredentialId) {
    try {
      await vapiFetch(`/credential/${trunk.vapiCredentialId}`, { method: "GET" });
      return trunk.vapiCredentialId;
    } catch {
      // credencial removida na Vapi — recria abaixo
    }
  }
  const created = (await vapiFetch("/credential", {
    method: "POST",
    body: JSON.stringify({
      provider: "byo-sip-trunk",
      name: `SIP (${trunk.sipUsername})`,
      gateways: [{ ip: trunk.sipHost }],
      outboundAuthenticationPlan: {
        authUsername: trunk.sipUsername,
        authPassword: trunk.sipPassword,
        sipRegisterPlan: { realm: trunk.sipHost },
      },
    }),
  })) as { id: string };

  await supabase
    .from("user_nvoip_credentials")
    .update({ vapi_credential_id: created.id, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return created.id;
}

// Recria/atualiza a credencial do tronco SIP na Vapi sob demanda.
export const ensureSipCredential = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .handler(async ({ context }) => {
    const trunk = await loadSipTrunk(context.supabase, context.userId);
    if (!trunk)
      return { ok: false as const, message: "Conecte seu tronco SIP primeiro." };
    try {
      const credentialId = await ensureSipCredentialId(
        context.supabase,
        context.userId,
        trunk,
      );
      return { ok: true as const, credentialId };
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : "Falha ao criar o tronco SIP na Vapi.",
      };
    }
  });


// Lists phone numbers imported on the Vapi account. Filtered/paginated by
// caller — Vapi returns all numbers on the account.
export const listVapiPhoneNumbers = createServerFn({ method: "GET" })
  .middleware([withVapiCredentials])
  .handler(async (): Promise<VapiPhoneNumberDTO[]> => {
    const data = await vapiFetch("/phone-number", { method: "GET" });
    if (!Array.isArray(data)) return [];
    return (data as VapiPhoneNumberRaw[]).map((n) => ({
      id: n.id,
      provider: (n.provider as string) ?? "nvoip",
      number: (n.number as string | undefined) ?? null,
      name: (n.name as string | undefined) ?? null,
      assistantId: (n.assistantId as string | undefined) ?? null,
    }));
  });

// Deletes a phone number from the Vapi account (used for the free test number).
export const deleteVapiPhoneNumber = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { id: string }) => ({ id: input.id }))
  .handler(async ({ data }) => {
    await vapiFetch(`/phone-number/${data.id}`, { method: "DELETE" });
    return { ok: true as const };
  });



// Provisions a FREE phone number issued by Vapi itself (provider "vapi",
// US numbers only). Useful for outbound test calls without owning a DID.
export const provisionFreeVapiNumber = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { areaCode?: string; name?: string } | undefined) => ({
    areaCode: input?.areaCode?.replace(/\D/g, "").slice(0, 3) || undefined,
    name: input?.name?.slice(0, 40) || undefined,
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; id: string; number: string | null }
      | { ok: false; message: string }
    > => {
      try {
        const created = (await vapiFetch("/phone-number", {
          method: "POST",
          body: JSON.stringify({
            provider: "vapi",
            name: data.name ?? "Número de teste Vapi",
            ...(data.areaCode ? { numberDesiredAreaCode: data.areaCode } : {}),
          }),
        })) as { id: string; number?: string } | null;
        if (!created?.id) return { ok: false, message: "Vapi não retornou o número criado." };
        return { ok: true, id: created.id, number: created.number ?? null };
      } catch (err) {
        const raw =
          err instanceof Error
            ? err.message
            : "Não foi possível provisionar um número gratuito da Vapi.";
        // Vapi só libera números gratuitos para algumas organizações/planos.
        if (/403|not available for this organization/i.test(raw)) {
          return {
            ok: false,
            message:
              "Sua organização na Vapi não tem liberação para números gratuitos. Conecte um número do seu tronco SIP como origem das ligações.",
          };
        }
        return { ok: false, message: raw };
      }

    },
  );

// Attaches (or replaces) the assistant on a given phone number. Imports the
// number on Vapi if it isn't there yet, using the user's own SIP trunk.
export const attachAssistantToNumber = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator(
    (input: { phoneNumberE164: string; assistantId: string; name?: string }) => {
      if (!input?.phoneNumberE164) throw new Error("phoneNumberE164 é obrigatório");
      if (!input?.assistantId) throw new Error("assistantId é obrigatório");
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<AttachAssistantResult> => {
    // Ownership: the assistant must belong to the current user.
    await assertOwnership(context.supabase, context.userId, data.assistantId);

    // Find existing Vapi phone-number entry (if any) for this E.164.
    // Vapi's /phone-number caps `limit` at 100 and rejects unknown params
    // like `page` — paginate with cursor (`createdAtLt` = last item's createdAt).
    let existing: VapiPhoneNumberRaw | undefined;
    let cursor: string | undefined;
    for (let i = 0; i < 20; i++) {
      const qs = new URLSearchParams({ limit: "100" });
      if (cursor) qs.set("createdAtLt", cursor);
      const chunk = (await vapiFetch(`/phone-number?${qs.toString()}`, {
        method: "GET",
      })) as (VapiPhoneNumberRaw & { createdAt?: string })[] | null;
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      existing = chunk.find(
        (n) => (n.number as string | undefined) === data.phoneNumberE164,
      );
      if (existing || chunk.length < 100) break;
      cursor = chunk[chunk.length - 1]?.createdAt;
      if (!cursor) break;
    }




    let vapiNumberId: string;
    let mirrorProvider = "nvoip";

    if (existing) {
      const patched = (await vapiFetch(`/phone-number/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assistantId: data.assistantId }),
      })) as VapiPhoneNumberRaw;
      vapiNumberId = patched.id;
    } else {
      const safeName = (data.name ?? data.phoneNumberE164)
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .slice(0, 40) || "Numero";

      // Único transporte: o tronco SIP do usuário (BYO SIP Trunk na Vapi).
      const trunk = await loadNvoipTrunk(context.supabase, context.userId);
      if (!trunk) {
        return {
          ok: false,
          reason: "sip_not_connected",
          message:
            "Conecte seu tronco SIP antes de vincular uma atendente a este número.",
        };
      }

      const credentialId = await ensureNvoipCredentialId(
        context.supabase,
        context.userId,
        trunk,
      );
      const body: Record<string, unknown> = {
        provider: "byo-phone-number",
        number: data.phoneNumberE164,
        credentialId,
        numberE164CheckEnabled: false,
        name: safeName,
      };

      let created: VapiPhoneNumberRaw;
      try {
        created = (await vapiFetch("/phone-number", {
          method: "POST",
          body: JSON.stringify(body),
        })) as VapiPhoneNumberRaw;

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already in use by another org/i.test(msg)) {
          return {
            ok: false,
            reason: "already_in_use",
            message: `O número ${data.phoneNumberE164} já está vinculado a outra organização Vapi. Remova-o de lá (Vapi Dashboard → Phone Numbers) antes de importá-lo aqui.`,
          };
        }
        throw err;
      }
      // Then attach assistant via PATCH (avoids some 400s on create).
      await vapiFetch(`/phone-number/${created.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assistantId: data.assistantId }),
      });
      vapiNumberId = created.id;
    }


    // Best-effort mirror to Supabase (schema-tolerant — columns may not exist).
    try {
      const { data: existingRow } = await context.supabase
        .from("user_phone_numbers")
        .select("id")
        .eq("user_id", context.userId)
        .eq("phone_number", data.phoneNumberE164)
        .maybeSingle();
      if (existingRow) {
        await context.supabase
          .from("user_phone_numbers")
          .update({
            assistant_id: data.assistantId,
            vapi_phone_number_id: vapiNumberId,
          })
          .eq("id", existingRow.id);
      } else {
        await context.supabase.from("user_phone_numbers").insert({
          user_id: context.userId,
          phone_number: data.phoneNumberE164,
          provider: mirrorProvider,

          assistant_id: data.assistantId,
          vapi_phone_number_id: vapiNumberId,
        });
      }
    } catch (e) {
      console.warn("mirror user_phone_numbers failed (non-fatal)", e);
    }

    return { ok: true as const, vapiNumberId, assistantId: data.assistantId };
  });

// Removes the assistant from a Vapi phone number (leaves the number itself
// imported on Vapi).
export const detachAssistantFromNumber = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { phoneNumberE164: string }) => {
    if (!input?.phoneNumberE164) throw new Error("phoneNumberE164 é obrigatório");
    return input;
  })
  .handler(async ({ data, context }) => {
    const all = (await vapiFetch("/phone-number", { method: "GET" })) as
      | VapiPhoneNumberRaw[]
      | null;
    const existing = Array.isArray(all)
      ? all.find((n) => (n.number as string | undefined) === data.phoneNumberE164)
      : undefined;
    if (existing) {
      await vapiFetch(`/phone-number/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assistantId: null }),
      });
    }
    try {
      await context.supabase
        .from("user_phone_numbers")
        .update({ assistant_id: null })
        .eq("user_id", context.userId)
        .eq("phone_number", data.phoneNumberE164);
    } catch (e) {
      console.warn("mirror detach user_phone_numbers failed (non-fatal)", e);
    }
    return { ok: true as const };
  });

// Reaplica a credencial do tronco SIP atual do usuário no número já cadastrado
// na Vapi. Corrige "call.start.error-get-transport", que acontece quando o
// número foi importado com dados de tronco antigos ou inválidos.
export const resyncVapiNumberCredentials = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { phoneNumberE164: string }) => {
    if (!input?.phoneNumberE164) throw new Error("phoneNumberE164 é obrigatório");
    return input;
  })
  .handler(async ({ data, context }) => {
    const trunk = await loadNvoipTrunk(context.supabase, context.userId);
    if (!trunk)
      return {
        ok: false as const,
        message: "Conecte seu tronco SIP antes de ressincronizar o número.",
      };
    const credentialId = await ensureNvoipCredentialId(
      context.supabase,
      context.userId,
      trunk,
    );

    const all = (await vapiFetch("/phone-number", { method: "GET" })) as
      | VapiPhoneNumberRaw[]
      | null;
    const existing = Array.isArray(all)
      ? all.find((n) => (n.number as string | undefined) === data.phoneNumberE164)
      : undefined;
    if (!existing)
      return { ok: false as const, message: "Número não encontrado na sua conta Vapi." };

    try {
      await vapiFetch(`/phone-number/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ credentialId }),
      });
      return { ok: true as const, message: "Credenciais do tronco SIP ressincronizadas." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ressincronizar.";
      return { ok: false as const, message: msg };
    }
  });


// Outbound test call — POST /call. Accepts either an existing Vapi
// phone-number id OR an E.164 number (imports it via the user's SIP trunk
// if not yet on Vapi).
export const createOutboundTestCall = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator(
    (input: {
      assistantId: string;
      phoneNumberId?: string;
      fromNumberE164?: string;
      customerNumber: string;
    }) => {
      if (!input?.assistantId) throw new Error("assistantId é obrigatório");
      if (!input?.phoneNumberId && !input?.fromNumberE164)
        throw new Error("Selecione um número de origem");
      const num = (input.customerNumber ?? "").trim();
      if (!/^\+[1-9]\d{6,14}$/.test(num))
        throw new Error("Número do celular deve estar em E.164 (ex: +5511999998888)");
      if (input.fromNumberE164 && !/^\+[1-9]\d{6,14}$/.test(input.fromNumberE164))
        throw new Error("Número de origem inválido");
      return { ...input, customerNumber: num };
    },
  )
  .handler(async ({ data, context }) => {
    await assertOwnership(context.supabase, context.userId, data.assistantId);

    let phoneNumberId = data.phoneNumberId;
    if (!phoneNumberId && data.fromNumberE164) {
      let existing: VapiPhoneNumberRaw | undefined;
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const qs = new URLSearchParams({ limit: "100" });
        if (cursor) qs.set("createdAtLt", cursor);
        const chunk = (await vapiFetch(`/phone-number?${qs.toString()}`, {
          method: "GET",
        })) as (VapiPhoneNumberRaw & { createdAt?: string })[] | null;
        if (!Array.isArray(chunk) || chunk.length === 0) break;
        existing = chunk.find((n) => n.number === data.fromNumberE164);
        if (existing || chunk.length < 100) break;
        cursor = chunk[chunk.length - 1]?.createdAt;
        if (!cursor) break;
      }
      if (existing) {
        phoneNumberId = existing.id;
      } else {
        const trunk = await loadNvoipTrunk(context.supabase, context.userId);
        if (!trunk)
          throw new Error(
            "Conecte seu tronco SIP para usar este número como origem.",
          );
        const credentialId = await ensureNvoipCredentialId(
          context.supabase,
          context.userId,
          trunk,
        );
        const safeName =
          data.fromNumberE164.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 40) ||
          "Numero SIP";
        const created = (await vapiFetch("/phone-number", {
          method: "POST",
          body: JSON.stringify({
            provider: "byo-phone-number",
            number: data.fromNumberE164,
            credentialId,
            numberE164CheckEnabled: false,
            name: safeName,
          }),
        })) as VapiPhoneNumberRaw;
        phoneNumberId = created.id;
      }
    }

    const res = (await vapiFetch("/call", {
      method: "POST",
      body: JSON.stringify({
        assistantId: data.assistantId,
        phoneNumberId,
        customer: { number: data.customerNumber },
      }),
    })) as { id?: string };
    return { ok: true as const, callId: res?.id ?? null };
  });

// Consulta o status/motivo de encerramento de uma chamada (diagnóstico de teste).
export const getVapiCallStatus = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { callId: string }) => {
    if (!input?.callId) throw new Error("callId obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    const call = (await vapiFetch(`/call/${data.callId}`, { method: "GET" })) as {
      status?: string;
      endedReason?: string;
      startedAt?: string;
      endedAt?: string;
    } | null;
    return {
      status: call?.status ?? null,
      endedReason: call?.endedReason ?? null,
      startedAt: call?.startedAt ?? null,
      endedAt: call?.endedAt ?? null,
    };
  });


// Cria uma chamada web oficial na Vapi.
// A documentação do Web SDK mostra que o fluxo real faz POST /call/web e
// retorna `webCallUrl`; o navegador deve entrar nessa sala para ouvir/falar.
export const createVapiWebCall = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { assistantId: string }) => {
    if (!input?.assistantId) throw new Error("assistantId é obrigatório");
    return { assistantId: input.assistantId };
  })
  .handler(async ({ data, context }) => {
    await assertOwnership(context.supabase, context.userId, data.assistantId);

    const savedPublicKey = await loadUserVapiPublicKey(
      context.supabase,
      context.userId,
    );
    let publicKey = savedPublicKey;
    let source: "saved" | "scoped" = "saved";
    if (!publicKey) {
      const scoped = await createScopedWebCallPublicToken(data.assistantId);
      publicKey = scoped.value;
      source = "scoped";
    }

    const payload = {
      assistantId: data.assistantId,
      roomDeleteOnUserLeaveEnabled: true,
    };

    const createWithKey = (key: string) =>
      vapiFetchWithKey(key, "/call/web", {
        method: "POST",
        body: JSON.stringify(payload),
      }) as Promise<{
        id?: string;
        webCallUrl?: string;
        assistant?: { name?: string; voice?: { provider?: string } };
        artifactPlan?: { videoRecordingEnabled?: boolean };
      } | null>;

    let webCall: Awaited<ReturnType<typeof createWithKey>>;
    try {
      webCall = await createWithKey(publicKey);
    } catch (error) {
      if (!savedPublicKey || !shouldRetryWebCallWithScopedToken(error)) throw error;
      const scoped = await createScopedWebCallPublicToken(data.assistantId);
      publicKey = scoped.value;
      source = "scoped";
      webCall = await createWithKey(publicKey);
    }

    if (!webCall?.webCallUrl) {
      throw new Error(
        "A Vapi criou a chamada web, mas não retornou a URL da sala (webCallUrl). Tente novamente em instantes.",
      );
    }

    return {
      id: webCall.id ?? null,
      webCallUrl: webCall.webCallUrl,
      assistant: webCall.assistant ?? null,
      artifactPlan: webCall.artifactPlan ?? null,
      source,
    };
  });


// List available voices for a given voice provider via Vapi voice-library.
export interface VapiVoiceOption {
  providerId: string;
  name: string;
  gender?: string;
  accent?: string;
  language?: string;
  languageCode?: string;
  previewUrl?: string;
  description?: string;
}

export const listVapiVoices = createServerFn({ method: "GET" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { provider: string }) => data)
  .handler(async ({ data }): Promise<VapiVoiceOption[]> => {
    const provider = (data.provider || "").trim();
    if (!provider) return [];
    // /voice-library existe só para providers externos (11labs, playht, cartesia...).
    // Para "vapi" (vozes nativas) e outros sem library pública, a API responde 404 —
    // devolvemos [] para o cliente cair no fallback estático em vez de exibir erro.
    let raw: unknown = null;
    try {
      raw = await vapiFetch(`/voice-library/${encodeURIComponent(provider)}`, {
        method: "GET",
      });
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const arr = raw as Array<Record<string, unknown>>;
    return arr
      .map((v) => ({
        providerId: String(v.providerId ?? v.slug ?? v.id ?? ""),
        name: String(v.name ?? v.providerId ?? ""),
        gender: typeof v.gender === "string" ? v.gender : undefined,
        accent: typeof v.accent === "string" ? v.accent : undefined,
        language: typeof v.language === "string" ? v.language : undefined,
        languageCode: typeof v.languageCode === "string" ? v.languageCode : undefined,
        previewUrl: typeof v.previewUrl === "string" ? v.previewUrl : undefined,
        description: typeof v.description === "string" ? v.description : undefined,
      }))
      .filter((v) => v.providerId && v.name);
  });

// Aggregate real cost/latency stats from recent calls for a given assistant.
// Prefer official Vapi fields: costBreakdown (STT/LLM/TTS/Vapi) and messages[].duration.
export interface AssistantCallStats {
  callCount: number;
  avgCostPerMin: number | null;
  avgLatencyMs: number | null;
  breakdown: {
    stt: number | null;
    llm: number | null;
    tts: number | null;
    vapi: number | null;
  };
}

export const getAssistantCallStats = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { assistantId: string }) => data)
  .handler(async ({ data }): Promise<AssistantCallStats> => {
    const empty: AssistantCallStats = {
      callCount: 0,
      avgCostPerMin: null,
      avgLatencyMs: null,
      breakdown: { stt: null, llm: null, tts: null, vapi: null },
    };
    if (!data.assistantId) return empty;
    let raw: unknown;
    try {
      raw = await vapiFetch(
        `/call?assistantId=${encodeURIComponent(data.assistantId)}&limit=50`,
        { method: "GET" },
      );
    } catch {
      return empty;
    }
    if (!Array.isArray(raw)) return empty;

    const calls = raw as Array<Record<string, unknown>>;
    const latencySamples: number[] = [];
    let totalCost = 0;
    let totalMinutes = 0;
    let sttSum = 0;
    let llmSum = 0;
    let ttsSum = 0;
    let vapiSum = 0;

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

    for (const c of calls) {
      const startedAt = typeof c.startedAt === "string" ? Date.parse(c.startedAt) : NaN;
      const endedAt = typeof c.endedAt === "string" ? Date.parse(c.endedAt) : NaN;
      const durSec =
        Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt > startedAt
          ? (endedAt - startedAt) / 1000
          : null;

      // --- Custo (ponderado por duração, total real da chamada) ---
      const breakdown =
        c.costBreakdown && typeof c.costBreakdown === "object"
          ? (c.costBreakdown as Record<string, unknown>)
          : null;

      if (durSec != null && durSec > 0) {
        // Prefer official total: call.cost > breakdown.total > soma de TODAS as chaves numéricas do breakdown
        let callTotal = num(c.cost) ?? (breakdown ? num(breakdown.total) : null);
        if (callTotal == null && breakdown) {
          let sum = 0;
          for (const [k, v] of Object.entries(breakdown)) {
            if (k === "total" || k === "breakdown" || k === "costs") continue;
            const n = num(v);
            if (n != null) sum += n;
          }
          callTotal = sum > 0 ? sum : null;
        }
        if (callTotal != null && callTotal > 0) {
          const minutes = durSec / 60;
          totalCost += callTotal;
          totalMinutes += minutes;
          if (breakdown) {
            const stt = num(breakdown.stt);
            const llm = num(breakdown.llm);
            const tts = num(breakdown.tts);
            const vfee = num(breakdown.vapi);
            if (stt != null) sttSum += stt;
            if (llm != null) llmSum += llm;
            if (tts != null) ttsSum += tts;
            if (vfee != null) vapiSum += vfee;
          }
        }
      }

      // --- Latência ---
      const analysis = (c.analysis && typeof c.analysis === "object")
        ? (c.analysis as Record<string, unknown>)
        : null;
      const directLat =
        num((c as { averageResponseLatency?: unknown }).averageResponseLatency) ??
        (analysis ? num(analysis.averageResponseLatency) : null);
      if (directLat != null && directLat > 0 && directLat < 15000) {
        latencySamples.push(directLat);
        continue;
      }

      const msgs = Array.isArray(c.messages) ? (c.messages as Array<Record<string, unknown>>) : [];
      let bestGap: number | null = null;
      for (let i = 0; i < msgs.length - 1; i++) {
        const cur = msgs[i];
        const nxt = msgs[i + 1];
        const curRole = String(cur.role ?? "");
        const nxtRole = String(nxt.role ?? "");
        if (curRole === "user" && (nxtRole === "bot" || nxtRole === "assistant")) {
          const endT =
            typeof cur.endTime === "number" ? cur.endTime :
            typeof cur.time === "number" ? cur.time : null;
          const startT =
            typeof nxt.time === "number" ? nxt.time :
            typeof nxt.secondsFromStart === "number" ? nxt.secondsFromStart * 1000 : null;
          if (endT != null && startT != null && startT > endT) {
            const gap = startT - endT;
            if (gap > 100 && gap < 5000 && (bestGap == null || gap < bestGap)) {
              bestGap = gap;
            }
          }
        }
      }
      if (bestGap != null) latencySamples.push(bestGap);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      callCount: calls.length,
      avgCostPerMin: totalMinutes > 0 ? totalCost / totalMinutes : null,
      avgLatencyMs: avg(latencySamples),
      breakdown: {
        stt: totalMinutes > 0 && sttSum > 0 ? sttSum / totalMinutes : null,
        llm: totalMinutes > 0 && llmSum > 0 ? llmSum / totalMinutes : null,
        tts: totalMinutes > 0 && ttsSum > 0 ? ttsSum / totalMinutes : null,
        vapi: totalMinutes > 0 && vapiSum > 0 ? vapiSum / totalMinutes : null,
      },
    };
  });

/* --------------------- Assistant card summary --------------------- */

export interface AssistantCardSummary {
  callCount: number;
  successRate: number | null;
  avgDurationSec: number | null;
  lastCallAt: string | null;
}

export const getAssistantCardSummary = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { assistantId: string }) => data)
  .handler(async ({ data }): Promise<AssistantCardSummary> => {
    const empty: AssistantCardSummary = {
      callCount: 0,
      successRate: null,
      avgDurationSec: null,
      lastCallAt: null,
    };
    if (!data.assistantId) return empty;
    let raw: unknown;
    try {
      raw = await vapiFetch(
        `/call?assistantId=${encodeURIComponent(data.assistantId)}&limit=100`,
        { method: "GET" },
      );
    } catch {
      return empty;
    }
    if (!Array.isArray(raw)) return empty;
    const calls = raw as Array<Record<string, unknown>>;

    let durationSamples = 0;
    let durationTotal = 0;
    let evaluated = 0;
    let successful = 0;
    let lastMs: number | null = null;

    const truthy = (s: string) => {
      const v = s.trim().toLowerCase();
      return v === "true" || v === "pass" || v === "passed" || v === "success" || v === "successful" || v === "yes";
    };
    const falsy = (s: string) => {
      const v = s.trim().toLowerCase();
      return v === "false" || v === "fail" || v === "failed" || v === "unsuccessful" || v === "no";
    };

    for (const c of calls) {
      const startedAt = typeof c.startedAt === "string" ? Date.parse(c.startedAt) : NaN;
      const endedAt = typeof c.endedAt === "string" ? Date.parse(c.endedAt) : NaN;
      if (Number.isFinite(startedAt)) {
        if (lastMs == null || startedAt > lastMs) lastMs = startedAt;
      }
      if (Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt > startedAt) {
        durationTotal += (endedAt - startedAt) / 1000;
        durationSamples += 1;
      }
      const analysis = c.analysis && typeof c.analysis === "object" ? (c.analysis as Record<string, unknown>) : null;
      const se = analysis?.successEvaluation;
      if (typeof se === "boolean") {
        evaluated += 1;
        if (se) successful += 1;
      } else if (typeof se === "string" && se.length > 0) {
        if (truthy(se)) {
          evaluated += 1;
          successful += 1;
        } else if (falsy(se)) {
          evaluated += 1;
        }
      } else if (typeof se === "number" && Number.isFinite(se)) {
        evaluated += 1;
        if (se >= 0.5) successful += 1;
      }
    }

    return {
      callCount: calls.length,
      successRate: evaluated > 0 ? Math.round((successful / evaluated) * 100) : null,
      avgDurationSec: durationSamples > 0 ? durationTotal / durationSamples : null,
      lastCallAt: lastMs != null ? new Date(lastMs).toISOString() : null,
    };
  });




/* --------------------- Logs (call list) --------------------- */

export interface AssistantCallLog {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  cost: number | null;
  costBreakdown: {
    stt: number | null;
    llm: number | null;
    tts: number | null;
    vapi: number | null;
    transport: number | null;
  };
  endedReason: string | null;
  status: string | null;
  type: string | null;
  customerNumber: string | null;
  phoneNumber: string | null;
  recordingUrl: string | null;
  transcript: string | null;
  summary: string | null;
  successEvaluation: string | null;
  // JSON-serializable capture from analysisPlan.structuredDataPlan
  structuredData: string | null;
}

export const listAssistantCalls = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { assistantId: string; limit?: number }) => data)
  .handler(async ({ data, context }): Promise<{ calls: AssistantCallLog[]; error: string | null }> => {
    if (!data.assistantId) return { calls: [], error: null };
    await assertOwnership(context.supabase, context.userId, data.assistantId);
    const limit = Math.min(Math.max(data.limit ?? 50, 1), 100);
    let raw: unknown;
    try {
      raw = await vapiFetch(
        `/call?assistantId=${encodeURIComponent(data.assistantId)}&limit=${limit}`,
        { method: "GET" },
      );
    } catch (e) {
      return { calls: [], error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
    if (!Array.isArray(raw)) return { calls: [], error: null };

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" && v.length ? v : null);

    const calls: AssistantCallLog[] = (raw as Array<Record<string, unknown>>).map((c) => {
      const startedAt = str(c.startedAt);
      const endedAt = str(c.endedAt);
      const startMs = startedAt ? Date.parse(startedAt) : NaN;
      const endMs = endedAt ? Date.parse(endedAt) : NaN;
      const durationSec =
        Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
          ? (endMs - startMs) / 1000
          : null;
      const breakdown =
        c.costBreakdown && typeof c.costBreakdown === "object"
          ? (c.costBreakdown as Record<string, unknown>)
          : null;
      const artifact =
        c.artifact && typeof c.artifact === "object"
          ? (c.artifact as Record<string, unknown>)
          : null;
      const analysis =
        c.analysis && typeof c.analysis === "object"
          ? (c.analysis as Record<string, unknown>)
          : null;
      const customer =
        c.customer && typeof c.customer === "object"
          ? (c.customer as Record<string, unknown>)
          : null;
      const phoneNumberObj =
        c.phoneNumber && typeof c.phoneNumber === "object"
          ? (c.phoneNumber as Record<string, unknown>)
          : null;
      return {
        id: String(c.id ?? ""),
        startedAt,
        endedAt,
        durationSec,
        cost: num(c.cost),
        costBreakdown: {
          stt: breakdown ? num(breakdown.stt) : null,
          llm: breakdown ? num(breakdown.llm) : null,
          tts: breakdown ? num(breakdown.tts) : null,
          vapi: breakdown ? num(breakdown.vapi) : null,
          transport: breakdown ? num(breakdown.transport) : null,
        },
        endedReason: str(c.endedReason),
        status: str(c.status),
        type: str(c.type),
        customerNumber: customer ? str(customer.number) : null,
        phoneNumber: (phoneNumberObj ? str(phoneNumberObj.number) : null) ?? str(c.phoneNumberId),
        recordingUrl:
          (artifact ? str(artifact.recordingUrl) : null) ??
          (artifact ? str(artifact.stereoRecordingUrl) : null) ??
          str(c.recordingUrl),
        transcript: artifact ? str(artifact.transcript) : null,
        summary: analysis ? str(analysis.summary) : null,
        successEvaluation: analysis ? str(analysis.successEvaluation) : null,
        structuredData:
          analysis && analysis.structuredData && typeof analysis.structuredData === "object"
            ? JSON.stringify(analysis.structuredData)
            : null,
      };
    });

    return { calls, error: null };
  });

/* --------------------- Analytics --------------------- */

export interface AssistantAnalytics {
  totals: { count: number; minutes: number; cost: number };
  daily: Array<{ date: string; count: number; minutes: number; cost: number }>;
  endedReasons: Array<{ reason: string; count: number }>;
  success: Array<{ label: string; count: number }>;
  costBreakdown: {
    stt: number;
    llm: number;
    tts: number;
    vapi: number;
    transport: number;
  };
  error: string | null;
}

export const getAssistantAnalytics = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { assistantId: string; rangeDays?: number }) => data)
  .handler(async ({ data, context }): Promise<AssistantAnalytics> => {
    const empty: AssistantAnalytics = {
      totals: { count: 0, minutes: 0, cost: 0 },
      daily: [],
      endedReasons: [],
      success: [],
      costBreakdown: { stt: 0, llm: 0, tts: 0, vapi: 0, transport: 0 },
      error: null,
    };
    if (!data.assistantId) return empty;
    await assertOwnership(context.supabase, context.userId, data.assistantId);

    const rangeDays = data.rangeDays && data.rangeDays > 0 ? data.rangeDays : 7;
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const timeRange = {
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: "America/Sao_Paulo",
    };

    const body = {
      queries: [
        {
          name: "totals",
          table: "call",
          groupBy: "assistantId",
          timeRange,
          operations: [
            { operation: "count", column: "id", alias: "count" },
            { operation: "sum", column: "duration", alias: "duration" },
            { operation: "sum", column: "minutesUsed", alias: "minutes" },
            { operation: "sum", column: "cost", alias: "cost" },
          ],
        },
        {
          name: "daily",
          table: "call",
          groupBy: "assistantId",
          timeRange: { ...timeRange, step: "day" },
          operations: [
            { operation: "count", column: "id", alias: "count" },
            { operation: "sum", column: "minutesUsed", alias: "minutes" },
            { operation: "sum", column: "cost", alias: "cost" },
          ],
        },
        {
          name: "endedReasons",
          table: "call",
          groupBy: "endedReason",
          timeRange,
          operations: [{ operation: "count", column: "id", alias: "count" }],
        },
        {
          name: "success",
          table: "call",
          groupBy: "analysis.successEvaluation",
          timeRange,
          operations: [{ operation: "count", column: "id", alias: "count" }],
        },
        {
          name: "costBreakdown",
          table: "call",
          groupBy: "assistantId",
          timeRange,
          operations: [
            { operation: "sum", column: "costBreakdown.stt", alias: "stt" },
            { operation: "sum", column: "costBreakdown.llm", alias: "llm" },
            { operation: "sum", column: "costBreakdown.tts", alias: "tts" },
            { operation: "sum", column: "costBreakdown.vapi", alias: "vapi" },
            { operation: "sum", column: "costBreakdown.transport", alias: "transport" },
          ],
        },
      ],
    };

    let raw: unknown;
    try {
      raw = await vapiFetch("/analytics", { method: "POST", body: JSON.stringify(body) });
    } catch (e) {
      return { ...empty, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
    if (!Array.isArray(raw)) return empty;

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const results = raw as Array<{ name?: string; result?: Array<Record<string, unknown>> }>;
    const byName = new Map(results.map((r) => [r.name ?? "", r.result ?? []]));
    const matches = (row: Record<string, unknown>) =>
      !("assistantId" in row) || row.assistantId === data.assistantId;

    const totalsRows = (byName.get("totals") ?? []).filter(matches);
    const t = totalsRows[0] ?? {};
    const totals = {
      count: num(t.count),
      minutes: num(t.minutes) || num(t.duration) / 60,
      cost: num(t.cost),
    };

    const dailyRows = (byName.get("daily") ?? []).filter(matches);
    const daily = dailyRows
      .map((r) => ({
        date: String(r.date ?? r.time ?? ""),
        count: num(r.count),
        minutes: num(r.minutes),
        cost: num(r.cost),
      }))
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const endedReasons = (byName.get("endedReasons") ?? [])
      .map((r) => ({ reason: String(r.endedReason ?? "desconhecido"), count: num(r.count) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const success = (byName.get("success") ?? [])
      .map((r) => {
        const key = r["analysis.successEvaluation"] ?? r.successEvaluation;
        return { label: String(key ?? "desconhecido"), count: num(r.count) };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const cbRows = (byName.get("costBreakdown") ?? []).filter(matches);
    const cb = cbRows[0] ?? {};
    const costBreakdown = {
      stt: num(cb.stt),
      llm: num(cb.llm),
      tts: num(cb.tts),
      vapi: num(cb.vapi),
      transport: num(cb.transport),
    };

    return { totals, daily, endedReasons, success, costBreakdown, error: null };
  });






/* ============================================================
   Vapi credentials — per-user account (BYOK)
   ============================================================ */

// Validates a Vapi private key by calling GET /assistant with limit=1.
async function validateVapiKey(key: string): Promise<void> {
  const res = await fetch("https://api.vapi.ai/assistant?limit=1", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Chave Vapi inválida. Verifique se copiou a Private Key correta.");
  }
  if (!res.ok) {
    throw new Error(`Falha ao validar chave Vapi (${res.status}). Tente novamente.`);
  }
}

export const saveVapiCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        privateKey: z.string().trim().min(20, "Chave muito curta"),
        publicKey: z
          .string()
          .trim()
          .min(20, "Public Key muito curta")
          .optional()
          .or(z.literal("")),
        friendlyLabel: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await validateVapiKey(data.privateKey);
    const publicKey =
      data.publicKey && data.publicKey.trim().length >= 20
        ? data.publicKey.trim()
        : null;
    const { error } = await context.supabase.from("user_vapi_credentials").upsert(
      {
        user_id: context.userId,
        private_key: data.privateKey,
        public_key: publicKey,
        friendly_label: data.friendlyLabel ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
    // Best-effort: garante um número de teste gratuito da Vapi já no onboarding.
    const testNumber = await ensureFreeVapiTestNumber(data.privateKey);
    return { ok: true, testNumber };
  });

// Creates a free Vapi-issued number (US) if the account doesn't have one yet.
// Never throws — provisioning isn't available on every Vapi organization.
async function ensureFreeVapiTestNumber(
  privateKey: string,
): Promise<{ id: string; number: string | null } | null> {
  const headers = {
    Authorization: `Bearer ${privateKey}`,
    "Content-Type": "application/json",
  };
  try {
    const listRes = await fetch("https://api.vapi.ai/phone-number?limit=100", {
      headers,
    });
    if (listRes.ok) {
      const list = (await listRes.json()) as
        | { id: string; provider?: string; number?: string }[]
        | null;
      const existing = Array.isArray(list)
        ? list.find((n) => n.provider === "vapi")
        : undefined;
      if (existing) return { id: existing.id, number: existing.number ?? null };
    }
    const createRes = await fetch("https://api.vapi.ai/phone-number", {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: "vapi",
        name: "Número de teste Vapi",
        numberDesiredAreaCode: "415",
      }),
    });
    if (!createRes.ok) return null;
    const created = (await createRes.json()) as { id?: string; number?: string } | null;
    if (!created?.id) return null;
    return { id: created.id, number: created.number ?? null };
  } catch {
    return null;
  }
}


export const updateVapiPublicKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ publicKey: z.string().trim().min(20, "Public Key muito curta") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_vapi_credentials")
      .update({ public_key: data.publicKey, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw new Error(`DB update failed: ${error.message}`);
    return { ok: true };
  });


export const getVapiConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_vapi_credentials")
      .select("friendly_label, updated_at, public_key")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { connected: false as const };
    const publicKey = (data.public_key as string | null) ?? null;
    return {
      connected: true as const,
      friendlyLabel: (data.friendly_label as string | null) ?? null,
      updatedAt: data.updated_at as string,
      hasPublicKey: !!(publicKey && publicKey.trim().length > 0),
    };
  });

export const disconnectVapi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_vapi_credentials")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Combined onboarding status — used pelo gate para redirecionar ao /onboarding.
 * Não usa `withVapiCredentials` porque precisa funcionar antes das chaves existirem.
 */
export const fetchRecordingAsDataUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        url: z.string().url().optional(),
        callId: z.string().uuid().optional(),
      })
      .refine((value) => !!value.url || !!value.callId, {
        message: "Informe o ID da chamada ou a URL da gravação.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let host: string | null = null;
    if (data.url) {
      try {
        host = new URL(data.url).hostname;
      } catch {
        throw new Error("URL inválida");
      }
      const allowed = /(^|\.)vapi\.ai$|(^|\.)daily\.co$|storage\.googleapis\.com$|(^|\.)r2\.cloudflarestorage\.com$|(^|\.)vapi-public\.[a-z0-9-]+\.amazonaws\.com$|(^|\.)amazonaws\.com$/i;
      if (!allowed.test(host)) {
        throw new Error(`A gravação existe, mas o domínio do arquivo ainda não está liberado para reprodução segura (${host}).`);
      }
    }

    const { data: cred } = await context.supabase
      .from("user_vapi_credentials")
      .select("private_key")
      .eq("user_id", context.userId)
      .maybeSingle();
    const privateKey = (cred as { private_key?: string } | null)?.private_key;

    const extractedCallId = data.url?.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1];
    const callId = data.callId ?? extractedCallId;

    const toDataUrl = async (res: Response) => {
      const contentType = res.headers.get("content-type") ?? "audio/wav";
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      return {
        dataUrl: `data:${contentType};base64,${btoa(binary)}`,
        contentType,
        bytes: buf.length,
      };
    };

    // Caminho oficial da Vapi: artefatos privados são baixados pela API com Private Key.
    // A API responde com redirect 302 para uma URL autenticada curta; fetch segue automaticamente.
    if (callId && privateKey) {
      const preferStereo = !!data.url && /stereo/i.test(data.url);
      const endpoints = preferStereo
        ? ["stereo-recording", "mono-recording"]
        : ["mono-recording", "stereo-recording"];
      let lastStatus = 0;
      for (const endpoint of endpoints) {
        const res = await fetch(`https://api.vapi.ai/call/${callId}/${endpoint}`, {
          method: "GET",
          redirect: "follow",
          headers: { Authorization: `Bearer ${privateKey}` },
        });
        if (res.ok) return toDataUrl(res);
        lastStatus = res.status;
        if (res.status === 401 || res.status === 403) {
          throw new Error("A Private Key da Vapi não autorizou o download da gravação. Atualize a chave em Configurações → API & Chaves.");
        }
      }

      // Último fallback: algumas chamadas antigas retornam uma URL pública/signed no objeto da chamada.
      const callRes = await fetch(`https://api.vapi.ai/call/${callId}`, {
        headers: { Authorization: `Bearer ${privateKey}` },
      });
      if (callRes.ok) {
        const call = (await callRes.json()) as {
          recordingUrl?: string;
          stereoRecordingUrl?: string;
          artifact?: { recordingUrl?: string; stereoRecordingUrl?: string };
        };
        const signed =
          call.artifact?.recordingUrl ??
          call.artifact?.stereoRecordingUrl ??
          call.recordingUrl ??
          call.stereoRecordingUrl;
        if (signed) {
          const res = await fetch(signed, { redirect: "follow" });
          if (res.ok) return toDataUrl(res);
          lastStatus = res.status;
        }
      }

      throw new Error(
        `Falha ao baixar gravação pela API oficial da Vapi (HTTP ${lastStatus || "indisponível"}). Confirme se a gravação está ativada e se a chamada já terminou de processar.`,
      );
    }

    if (!data.url) {
      throw new Error("Não foi possível identificar a URL da gravação.");
    }

    const directRes = await fetch(data.url, { redirect: "follow" });
    if (!directRes.ok) {
      throw new Error(
        `Falha ao baixar gravação (HTTP ${directRes.status}). Se a gravação for privada, salve a Private Key correta da Vapi e tente novamente.`,
      );
    }
    return toDataUrl(directRes);
  });

export const getSetupStatus = createServerFn({ method: "GET" })

  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [vapiRes, nvoipRes] = await Promise.all([
      context.supabase
        .from("user_vapi_credentials")
        .select("user_id, public_key")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("user_nvoip_credentials")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    const vapiRow = vapiRes.data as { public_key: string | null } | null;
    const hasVapiPublicKey = !!(vapiRow?.public_key && vapiRow.public_key.trim().length > 0);
    const nvoip = !!nvoipRes.data;
    return {
      vapi: !!vapiRes.data && hasVapiPublicKey,
      // `telefonia`: tronco SIP do usuário configurado.
      telefonia: nvoip,
      nvoip,
      vapiPrivateOnly: !!vapiRes.data && !hasVapiPublicKey,
    };

  });

/* --------------- Structured Outputs (Vapi Structured Output API) --------------- */

export interface StructuredSchemaField {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
}

type VapiStructuredOutput = Record<string, unknown> & {
  id?: string;
  name?: string;
  description?: string;
  schema?: Record<string, unknown>;
  assistantIds?: string[];
};

function normalizeStructuredFieldType(t: unknown): StructuredSchemaField["type"] {
  return t === "number" || t === "integer" ? "number" : t === "boolean" ? "boolean" : "string";
}

function structuredOutputToField(output: VapiStructuredOutput): StructuredSchemaField | null {
  const name = typeof output.name === "string" ? output.name.trim() : "";
  if (!name) return null;
  const schema = output.schema ?? {};
  return {
    name,
    type: normalizeStructuredFieldType(schema.type),
    description:
      (typeof output.description === "string" && output.description) ||
      (typeof schema.description === "string" && schema.description) ||
      "",
  };
}

async function listVapiStructuredOutputs(assistantId: string): Promise<VapiStructuredOutput[]> {
  const listed = (await vapiFetch("/structured-output?limit=100", { method: "GET" })) as
    | { results?: VapiStructuredOutput[] }
    | VapiStructuredOutput[]
    | null;
  const results = Array.isArray(listed) ? listed : Array.isArray(listed?.results) ? listed.results : [];
  return results.filter((output) =>
    Array.isArray(output.assistantIds) ? output.assistantIds.includes(assistantId) : false,
  );
}

function buildStructuredOutputPayload(
  field: StructuredSchemaField,
  assistantId: string,
  assistantIds: string[] = [],
  opts: { includeType?: boolean } = {},
) {
  const description = field.description || `Extraia o valor de ${field.name} a partir da conversa.`;
  const payload: Record<string, unknown> = {
    name: field.name,
    description,
    schema: {
      type: field.type,
      description,
    },
    assistantIds: Array.from(new Set([...assistantIds, assistantId])),
  };
  if (opts.includeType) payload.type = "ai";
  return payload;
}


export const getAssistantStructuredSchema = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { assistantId: string }) => data)
  .handler(async ({ data, context }): Promise<{ fields: StructuredSchemaField[] }> => {
    if (!data.assistantId) return { fields: [] };
    await assertOwnership(context.supabase, context.userId, data.assistantId);
    const raw = (await vapiFetch(`/assistant/${data.assistantId}`, { method: "GET" })) as
      | Record<string, unknown>
      | null;
    const analysisPlan = (raw?.analysisPlan as Record<string, unknown> | undefined) ?? {};
    const metadata = (raw?.metadata as Record<string, unknown> | undefined) ?? {};
    const artifactPlan = (raw?.artifactPlan as Record<string, unknown> | undefined) ?? {};

    const fields: StructuredSchemaField[] = [];
    const seen = new Set<string>();
    const pushField = (name: string, def: { type?: unknown; description?: unknown } | undefined) => {
      const key = (name ?? "").trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      fields.push({
        name: key,
        type: normalizeStructuredFieldType(def?.type),
        description: typeof def?.description === "string" ? def.description : "",
      });
    };

    // 1) Legacy single-schema: analysisPlan.structuredDataPlan.schema.properties
    const singlePlan = analysisPlan.structuredDataPlan as Record<string, unknown> | undefined;
    const singleSchema = singlePlan?.schema as Record<string, unknown> | undefined;
    const singleProps = (singleSchema?.properties ?? {}) as Record<
      string,
      { type?: unknown; description?: unknown }
    >;
    for (const [name, def] of Object.entries(singleProps)) pushField(name, def);

    // 2) analysisPlan.structuredDataMultiPlan[]
    const multi = analysisPlan.structuredDataMultiPlan as unknown;
    if (Array.isArray(multi)) {
      for (const entry of multi) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const key = typeof e.key === "string" ? e.key : "";
        const plan = (e.plan as Record<string, unknown> | undefined) ?? {};
        const schema = plan.schema as Record<string, unknown> | undefined;
        if (schema && (schema.type === "object" || schema.type === undefined)) {
          const props = (schema.properties ?? {}) as Record<
            string,
            { type?: unknown; description?: unknown }
          >;
          if (Object.keys(props).length > 0) {
            for (const [name, def] of Object.entries(props)) pushField(name, def);
            continue;
          }
        }
        if (key) pushField(key, { type: schema?.type, description: schema?.description });
      }
    }

    // 3) Reusable Structured Outputs attached to the assistant.
    // Vapi processes extraction from artifactPlan.structuredOutputIds; metadata
    // is read only for compatibility with older local saves.
    const ids = Array.from(
      new Set(
        [artifactPlan.structuredOutputIds, metadata.structuredOutputIds]
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    if (Array.isArray(ids) && ids.length > 0) {
      const results = await Promise.allSettled(
        ids.map((id) => vapiFetch(`/structured-output/${id}`, { method: "GET" })),
      );
      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value || typeof r.value !== "object") continue;
        const so = r.value as Record<string, unknown>;
        const name =
          (typeof so.name === "string" && so.name) ||
          (typeof so.key === "string" && so.key) ||
          "";
        const schema = (so.schema as Record<string, unknown> | undefined) ?? undefined;
        const description =
          (typeof so.description === "string" && so.description) ||
          (typeof schema?.description === "string" && schema.description) ||
          "";
        pushField(name, { type: schema?.type, description });
      }
    }

    // 4) Official reusable Structured Outputs linked with assistantIds.
    // This is the format used by the current Vapi dashboard Analysis tab.
    const linkedOutputs = await listVapiStructuredOutputs(data.assistantId);
    for (const output of linkedOutputs) {
      const field = structuredOutputToField(output);
      if (field) pushField(field.name, { type: field.type, description: field.description });
    }

    return { fields };
  });



export const updateAssistantStructuredSchema = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator(
    (data: { assistantId: string; fields: StructuredSchemaField[] }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.assistantId) throw new Error("assistantId é obrigatório");
    await assertOwnership(context.supabase, context.userId, data.assistantId);

    const raw = (await vapiFetch(`/assistant/${data.assistantId}`, { method: "GET" })) as
      | Record<string, unknown>
      | null;

    const cleaned = (data.fields ?? [])
      .map((f) => ({
        name: (f.name ?? "").trim(),
        type: f.type,
        description: (f.description ?? "").trim(),
      }))
      .filter((f) => f.name.length > 0);

    const metadata = ((raw?.metadata as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const artifactPlan = ((raw?.artifactPlan as Record<string, unknown> | undefined) ?? {}) as Record<
      string,
      unknown
    >;
    const attachedIds = Array.from(
      new Set(
        [artifactPlan.structuredOutputIds, metadata.structuredOutputIds]
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    const [listedOutputs, metadataOutputs] = await Promise.all([
      listVapiStructuredOutputs(data.assistantId),
      Promise.allSettled(attachedIds.map((id) => vapiFetch(`/structured-output/${id}`, { method: "GET" }))),
    ]);

    const existingOutputs = new Map<string, VapiStructuredOutput>();
    for (const output of listedOutputs) {
      if (output.id) existingOutputs.set(output.id, output);
    }
    for (const result of metadataOutputs) {
      if (result.status === "fulfilled" && result.value && typeof result.value === "object") {
        const output = result.value as VapiStructuredOutput;
        if (output.id) existingOutputs.set(output.id, output);
      }
    }

    const outputsByName = new Map<string, VapiStructuredOutput>();
    for (const output of existingOutputs.values()) {
      const name = typeof output.name === "string" ? output.name.trim() : "";
      if (name) outputsByName.set(name, output);
    }

    const savedStructuredOutputIds: string[] = [];
    for (const field of cleaned) {
      const existing = outputsByName.get(field.name);
      const saved = existing?.id
        ? ((await vapiFetch(`/structured-output/${existing.id}?schemaOverride=true`, {
            method: "PATCH",
            body: JSON.stringify(
              buildStructuredOutputPayload(field, data.assistantId, existing.assistantIds ?? [], {
                includeType: false,
              }),
            ),
          })) as VapiStructuredOutput | null)
        : ((await vapiFetch("/structured-output", {
            method: "POST",
            body: JSON.stringify(
              buildStructuredOutputPayload(field, data.assistantId, existing?.assistantIds ?? [], {
                includeType: true,
              }),
            ),
          })) as VapiStructuredOutput | null);
      if (saved?.id) savedStructuredOutputIds.push(saved.id);

    }

    const wantedNames = new Set(cleaned.map((f) => f.name));
    await Promise.allSettled(
      Array.from(existingOutputs.values())
        .filter((output) => {
          const name = typeof output.name === "string" ? output.name.trim() : "";
          return output.id && name && !wantedNames.has(name) && output.assistantIds?.includes(data.assistantId);
        })
        .map((output) =>
          vapiFetch(`/structured-output/${output.id}?schemaOverride=true`, {
            method: "PATCH",
            body: JSON.stringify({
              name: output.name,
              description: output.description,
              schema: output.schema,
              assistantIds: (output.assistantIds ?? []).filter((id) => id !== data.assistantId),
            }),
          }),
        ),
    );

    const rawAnalysisPlan = ((raw?.analysisPlan as Record<string, unknown> | undefined) ?? {}) as Record<
      string,
      unknown
    >;
    const analysisPlan: Record<string, unknown> = { ...rawAnalysisPlan, ...ANALYSIS_PLAN_SAME_LANGUAGE };

    // Keep legacy plan shapes in sync for older analytics payloads, but the
    // current Vapi dashboard uses the official /structured-output objects above.
    if (cleaned.length > 0) {
      analysisPlan.structuredDataMultiPlan = cleaned.map((f) => ({
        key: f.name,
        plan: {
          enabled: true,
          schema: {
            type: f.type,
            description: f.description || `Extraia o valor de ${f.name} a partir da conversa.`,
          },
        },
      }));
      // Keep legacy plan in sync for older consumers / analytics.
      const properties: Record<string, { type: string; description: string }> = {};
      for (const f of cleaned) {
        properties[f.name] = { type: f.type, description: f.description };
      }
      analysisPlan.structuredDataPlan = {
        enabled: true,
        schema: {
          type: "object",
          properties,
          required: cleaned.map((f) => f.name),
        },
      };
    } else {
      analysisPlan.structuredDataMultiPlan = [];
      analysisPlan.structuredDataPlan = { enabled: false };
    }

    await vapiFetch(`/assistant/${data.assistantId}`, {
      method: "PATCH",
      body: JSON.stringify({
        analysisPlan,
        artifactPlan: {
          ...artifactPlan,
          structuredOutputIds: savedStructuredOutputIds,
        },
        metadata: {
          ...metadata,
          structuredOutputIds: savedStructuredOutputIds,
        },
      }),
    });
    return { ok: true };
  });

// ---------- gestão estimada de créditos Vapi ----------
// A Vapi não expõe endpoint oficial de saldo/créditos. Calculamos o saldo
// estimado a partir do orçamento informado pelo usuário menos o gasto real
// das chamadas (campo `cost` do objeto call).

export interface VapiEstimatedCreditsDTO {
  ok: boolean;
  budget: number | null;
  spent: number | null;
  balance: number | null;
  currency: string;
  usageRatio: number;
  lowBalance: boolean;
  lowBalanceThreshold: number;
  callsCount: number;
  lastCallAt: string | null;
  error: string | null;
}

export const getVapiEstimatedCredits = createServerFn({ method: "GET" })
  .middleware([withVapiCredentials])
  .handler(async ({ context }): Promise<VapiEstimatedCreditsDTO> => {
    const { supabase, userId } = context;

    const { data: settings, error: settingsError } = await supabase
      .from("user_vapi_settings")
      .select("credits_budget, low_balance_threshold")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsError) {
      return {
        ok: false,
        budget: null,
        spent: null,
        balance: null,
        currency: "USD",
        usageRatio: 0,
        lowBalance: false,
        lowBalanceThreshold: 0.2,
        callsCount: 0,
        lastCallAt: null,
        error: `Falha ao carregar configurações: ${settingsError.message}`,
      };
    }

    const budget =
      typeof settings?.credits_budget === "number" ? settings.credits_budget : null;
    const lowBalanceThreshold =
      typeof settings?.low_balance_threshold === "number"
        ? Math.min(1, Math.max(0, settings.low_balance_threshold))
        : 0.2;

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString();

    let calls: Array<Record<string, unknown>> = [];
    try {
      const res = (await vapiFetch(
        `/call?createdAtGe=${encodeURIComponent(sinceIso)}&limit=100`,
        { method: "GET" },
      )) as unknown;
      calls = Array.isArray(res) ? res : [];
    } catch (err) {
      return {
        ok: false,
        budget,
        spent: null,
        balance: budget,
        currency: "USD",
        usageRatio: 0,
        lowBalance: false,
        lowBalanceThreshold,
        callsCount: 0,
        lastCallAt: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    let spent = 0;
    let callsCount = 0;
    let lastCallAt: string | null = null;

    for (const c of calls) {
      const cost = num(c.cost);
      if (cost != null && cost > 0) {
        spent += cost;
        callsCount++;
      }
      const endedAt = typeof c.endedAt === "string" ? c.endedAt : null;
      if (endedAt && (!lastCallAt || endedAt > lastCallAt)) {
        lastCallAt = endedAt;
      }
    }

    const roundedSpent = Math.round(spent * 10000) / 10000;
    const balance =
      typeof budget === "number" ? Math.max(0, budget - roundedSpent) : null;
    const usageRatio =
      typeof budget === "number" && budget > 0
        ? Math.min(1, Math.max(0, roundedSpent / budget))
        : 0;
    const lowBalance = usageRatio >= 1 - lowBalanceThreshold;

    return {
      ok: true,
      budget,
      spent: roundedSpent,
      balance,
      currency: "USD",
      usageRatio,
      lowBalance,
      lowBalanceThreshold,
      callsCount,
      lastCallAt,
      error: null,
    };
  });

export const saveVapiBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { budget: number; lowBalanceThreshold?: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const budget = Math.max(0, Number(data.budget) || 0);
    const threshold =
      typeof data.lowBalanceThreshold === "number"
        ? Math.min(1, Math.max(0, data.lowBalanceThreshold))
        : 0.2;

    const { error } = await supabase.from("user_vapi_settings").upsert(
      {
        user_id: userId,
        credits_budget: budget,
        low_balance_threshold: threshold,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(`Falha ao salvar orçamento: ${error.message}`);
    return { ok: true, budget, lowBalanceThreshold: threshold };
  });

// Mantido para compatibilidade; retorna aviso de que a Vapi não expõe saldo.
export const getVapiCredits = createServerFn({ method: "GET" })
  .middleware([withVapiCredentials])
  .handler(async () => {
    return {
      ok: false,
      credits: null,
      billingLimit: null,
      name: null,
      plan: null,
      error:
        "A Vapi não disponibiliza um endpoint oficial de créditos. Use a gestão estimada baseada nas chamadas.",
    };
  });

/* --------------------- Dashboard overview --------------------- */

export interface DashboardCallRow {
  id: string;
  startedAt: string | null;
  direction: "inbound" | "outbound" | "web";
  phone: string | null;
  durationSec: number | null;
  cost: number | null;
  endedReason: string | null;
  status: string | null;
  assistantName: string | null;
  successEvaluation: boolean | null;
}

export interface DashboardOverview {
  configured: boolean;
  error: string | null;
  rangeDays: number;
  totals: {
    calls: number;
    cost: number;
    minutes: number;
    qualified: number;
    answered: number;
    answerRate: number | null;
    avgDurationSec: number | null;
    inbound: number;
    outbound: number;
  };
  deltas: {
    calls: number | null;
    cost: number | null;
    qualified: number | null;
    answerRate: number | null;
  };
  daily: Array<{ date: string; label: string; inbound: number; outbound: number; cost: number }>;
  costBreakdown: { stt: number; llm: number; tts: number; vapi: number; transport: number };
  endedReasons: Array<{ reason: string; count: number }>;
  topAssistants: Array<{ id: string; name: string; calls: number; cost: number; minutes: number }>;
  recent: DashboardCallRow[];
}

function emptyDashboard(rangeDays: number, error: string | null): DashboardOverview {
  return {
    configured: true,
    error,
    rangeDays,
    totals: {
      calls: 0,
      cost: 0,
      minutes: 0,
      qualified: 0,
      answered: 0,
      answerRate: null,
      avgDurationSec: null,
      inbound: 0,
      outbound: 0,
    },
    deltas: { calls: null, cost: null, qualified: null, answerRate: null },
    daily: [],
    costBreakdown: { stt: 0, llm: 0, tts: 0, vapi: 0, transport: 0 },
    endedReasons: [],
    topAssistants: [],
    recent: [],
  };
}

export const getDashboardOverview = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((data: { rangeDays?: number } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<DashboardOverview> => {
    let rangeDays = Math.min(Math.max(data.rangeDays ?? 30, 1), 90);
    const now = Date.now();
    let startCurrent = now - rangeDays * 86400000;
    let startPrevious = now - rangeDays * 2 * 86400000;
    let notice: string | null = null;

    const fetchCalls = async (sinceMs: number | null) =>
      vapiFetch(
        sinceMs == null
          ? `/call?limit=1000`
          : `/call?limit=1000&createdAtGe=${encodeURIComponent(new Date(sinceMs).toISOString())}`,
        { method: "GET" },
      );

    let raw: unknown;
    try {
      raw = await fetchCalls(startPrevious);
    } catch (e) {
      // O plano da Vapi pode limitar a janela de retenção do histórico de chamadas.
      const msg = e instanceof Error ? e.message : "";
      const match = msg.match(/adjust your date filter to ([A-Za-z]{3} [A-Za-z]{3} \d{1,2} \d{4})/i);
      const suggested = match ? Date.parse(match[1]) : NaN;
      const earliest = Number.isFinite(suggested) ? suggested + 86400000 : now - 13 * 86400000;
      const availableDays = Math.max(1, Math.floor((now - earliest) / 86400000));
      const effective = Math.max(1, Math.min(rangeDays, Math.floor(availableDays / 2) || 1));
      try {
        raw = await fetchCalls(earliest);
      } catch {
        try {
          raw = await fetchCalls(null);
        } catch (e2) {
          return emptyDashboard(
            rangeDays,
            e2 instanceof Error ? e2.message : "Erro ao consultar a Vapi",
          );
        }
      }
      if (effective < rangeDays) {
        notice = `Seu plano da Vapi retém apenas ${availableDays} dias de histórico. As métricas usam os últimos ${effective} dias.`;
        rangeDays = effective;
        startCurrent = now - rangeDays * 86400000;
        startPrevious = now - rangeDays * 2 * 86400000;
      }
    }
    if (!Array.isArray(raw)) return emptyDashboard(rangeDays, notice);


    let assistantNames = new Map<string, string>();
    try {
      const list = await vapiFetch("/assistant?limit=100", { method: "GET" });
      if (Array.isArray(list)) {
        assistantNames = new Map(
          (list as Array<Record<string, unknown>>)
            .filter((a) => typeof a.id === "string")
            .map((a) => [String(a.id), String(a.name ?? "Sem nome")]),
        );
      }
    } catch {
      /* nomes são opcionais */
    }

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const str = (v: unknown) => (typeof v === "string" && v.length ? v : null);
    const truthy = (s: string) => {
      const v = s.trim().toLowerCase();
      return ["true", "pass", "passed", "success", "successful", "yes"].includes(v);
    };

    interface Norm {
      id: string;
      ms: number;
      startedAt: string | null;
      direction: "inbound" | "outbound" | "web";
      phone: string | null;
      durationSec: number | null;
      cost: number;
      breakdown: { stt: number; llm: number; tts: number; vapi: number; transport: number };
      endedReason: string | null;
      status: string | null;
      assistantId: string | null;
      assistantName: string | null;
      success: boolean | null;
    }

    const calls: Norm[] = (raw as Array<Record<string, unknown>>).map((c) => {
      const createdAt = str(c.createdAt) ?? str(c.startedAt);
      const ms = createdAt ? Date.parse(createdAt) : NaN;
      const startMs = str(c.startedAt) ? Date.parse(String(c.startedAt)) : NaN;
      const endMs = str(c.endedAt) ? Date.parse(String(c.endedAt)) : NaN;
      const durationSec =
        Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
          ? (endMs - startMs) / 1000
          : null;
      const b =
        c.costBreakdown && typeof c.costBreakdown === "object"
          ? (c.costBreakdown as Record<string, unknown>)
          : {};
      const customer =
        c.customer && typeof c.customer === "object" ? (c.customer as Record<string, unknown>) : null;
      const phoneObj =
        c.phoneNumber && typeof c.phoneNumber === "object"
          ? (c.phoneNumber as Record<string, unknown>)
          : null;
      const analysis =
        c.analysis && typeof c.analysis === "object" ? (c.analysis as Record<string, unknown>) : null;
      const se = analysis?.successEvaluation;
      const success =
        typeof se === "boolean"
          ? se
          : typeof se === "string" && se.length
            ? truthy(se)
            : typeof se === "number" && Number.isFinite(se)
              ? se >= 0.5
              : null;
      const type = (str(c.type) ?? "").toLowerCase();
      const direction: "inbound" | "outbound" | "web" = type.includes("inbound")
        ? "inbound"
        : type.includes("web")
          ? "web"
          : "outbound";
      const assistantId = str(c.assistantId);
      return {
        id: String(c.id ?? ""),
        ms: Number.isFinite(ms) ? ms : 0,
        startedAt: str(c.startedAt) ?? createdAt,
        direction,
        phone: (customer ? str(customer.number) : null) ?? (phoneObj ? str(phoneObj.number) : null),
        durationSec,
        cost: num(c.cost),
        breakdown: {
          stt: num(b.stt),
          llm: num(b.llm),
          tts: num(b.tts),
          vapi: num(b.vapi),
          transport: num(b.transport),
        },
        endedReason: str(c.endedReason),
        status: str(c.status),
        assistantId,
        assistantName: assistantId ? (assistantNames.get(assistantId) ?? null) : null,
        success,
      };
    });

    const current = calls.filter((c) => c.ms >= startCurrent);
    const previous = calls.filter((c) => c.ms >= startPrevious && c.ms < startCurrent);

    const agg = (rows: Norm[]) => {
      let cost = 0;
      let seconds = 0;
      let qualified = 0;
      let answered = 0;
      let inbound = 0;
      let outbound = 0;
      for (const r of rows) {
        cost += r.cost;
        seconds += r.durationSec ?? 0;
        if (r.success === true) qualified += 1;
        if ((r.durationSec ?? 0) > 5) answered += 1;
        if (r.direction === "inbound") inbound += 1;
        else outbound += 1;
      }
      const answerRate = rows.length > 0 ? (answered / rows.length) * 100 : null;
      return {
        calls: rows.length,
        cost,
        minutes: seconds / 60,
        qualified,
        answered,
        answerRate,
        avgDurationSec: rows.length > 0 ? seconds / rows.length : null,
        inbound,
        outbound,
      };
    };

    const totals = agg(current);
    const prev = agg(previous);
    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

    // Série diária (últimos N dias, no máximo 30 pontos)
    const points = Math.min(rangeDays, 30);
    const daily: DashboardOverview["daily"] = [];
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      daily.push({
        date: key,
        label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
        inbound: 0,
        outbound: 0,
        cost: 0,
      });
    }
    const dayIndex = new Map(daily.map((d, i) => [d.date, i]));
    for (const c of current) {
      const key = new Date(c.ms).toISOString().slice(0, 10);
      const idx = dayIndex.get(key);
      if (idx == null) continue;
      if (c.direction === "inbound") daily[idx].inbound += 1;
      else daily[idx].outbound += 1;
      daily[idx].cost += c.cost;
    }

    const costBreakdown = { stt: 0, llm: 0, tts: 0, vapi: 0, transport: 0 };
    const reasonMap = new Map<string, number>();
    const assistantMap = new Map<string, { name: string; calls: number; cost: number; minutes: number }>();
    for (const c of current) {
      costBreakdown.stt += c.breakdown.stt;
      costBreakdown.llm += c.breakdown.llm;
      costBreakdown.tts += c.breakdown.tts;
      costBreakdown.vapi += c.breakdown.vapi;
      costBreakdown.transport += c.breakdown.transport;
      if (c.endedReason) reasonMap.set(c.endedReason, (reasonMap.get(c.endedReason) ?? 0) + 1);
      if (c.assistantId) {
        const entry = assistantMap.get(c.assistantId) ?? {
          name: c.assistantName ?? "Sem nome",
          calls: 0,
          cost: 0,
          minutes: 0,
        };
        entry.calls += 1;
        entry.cost += c.cost;
        entry.minutes += (c.durationSec ?? 0) / 60;
        assistantMap.set(c.assistantId, entry);
      }
    }

    const recent: DashboardCallRow[] = [...current]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        startedAt: c.startedAt,
        direction: c.direction,
        phone: c.phone,
        durationSec: c.durationSec,
        cost: c.cost,
        endedReason: c.endedReason,
        status: c.status,
        assistantName: c.assistantName,
        successEvaluation: c.success,
      }));

    return {
      configured: true,
      error: notice,
      rangeDays,
      totals,
      deltas: {
        calls: pct(totals.calls, prev.calls),
        cost: pct(totals.cost, prev.cost),
        qualified: pct(totals.qualified, prev.qualified),
        answerRate:
          totals.answerRate != null && prev.answerRate != null
            ? totals.answerRate - prev.answerRate
            : null,
      },
      daily,
      costBreakdown,
      endedReasons: [...reasonMap.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      topAssistants: [...assistantMap.entries()]
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 5),
      recent,
    };
  });

// --- Campanhas (outbound em massa) -----------------------------------------
// Documentação: https://docs.vapi.ai/api-reference/campaigns

export interface VapiCampaignDTO {
  id: string;
  name: string;
  status: string;
  assistantId: string | null;
  phoneNumberId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  endedReason: string | null;
  counters: {
    scheduled: number;
    queued: number;
    inProgress: number;
    ended: number;
    voicemail: number;
  };
  customersCount: number;
}

interface VapiCampaignRaw {
  id: string;
  name?: string;
  status?: string;
  assistantId?: string;
  phoneNumberId?: string;
  createdAt?: string;
  updatedAt?: string;
  endedReason?: string;
  callsCounterScheduled?: number;
  callsCounterQueued?: number;
  callsCounterInProgress?: number;
  callsCounterEnded?: number;
  callsCounterEndedVoicemail?: number;
  customers?: unknown[];
}

function mapCampaign(c: VapiCampaignRaw): VapiCampaignDTO {
  return {
    id: c.id,
    name: c.name ?? "Campanha",
    status: c.status ?? "scheduled",
    assistantId: c.assistantId ?? null,
    phoneNumberId: c.phoneNumberId ?? null,
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
    endedReason: c.endedReason ?? null,
    counters: {
      scheduled: c.callsCounterScheduled ?? 0,
      queued: c.callsCounterQueued ?? 0,
      inProgress: c.callsCounterInProgress ?? 0,
      ended: c.callsCounterEnded ?? 0,
      voicemail: c.callsCounterEndedVoicemail ?? 0,
    },
    customersCount: Array.isArray(c.customers) ? c.customers.length : 0,
  };
}

export const listVapiCampaigns = createServerFn({ method: "GET" })
  .middleware([withVapiCredentials])
  .handler(async (): Promise<VapiCampaignDTO[]> => {
    const data = await vapiFetch("/campaign", { method: "GET" });
    const list = Array.isArray(data)
      ? (data as VapiCampaignRaw[])
      : (((data as { results?: VapiCampaignRaw[] } | null)?.results ?? []) as VapiCampaignRaw[]);
    return list
      .map(mapCampaign)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  });

const campaignCustomerSchema = z.object({
  number: z.string().trim().min(6, "Número inválido").max(20),
  name: z.string().trim().max(120).optional(),
});

const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da campanha").max(120),
  assistantId: z.string().trim().min(1, "Selecione uma assistente"),
  phoneNumberId: z.string().trim().min(1, "Selecione um número de origem"),
  customers: z.array(campaignCustomerSchema).min(1, "Envie ao menos um contato").max(5000),
  startedAt: z.string().trim().optional(),
  latestAt: z.string().trim().optional(),
});

export const createVapiCampaign = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: unknown) => createCampaignSchema.parse(input))
  .handler(async ({ data }): Promise<VapiCampaignDTO> => {
    const schedulePlan =
      data.startedAt || data.latestAt
        ? {
            ...(data.startedAt ? { earliestAt: new Date(data.startedAt).toISOString() } : {}),
            ...(data.latestAt ? { latestAt: new Date(data.latestAt).toISOString() } : {}),
          }
        : undefined;

    const body = {
      name: data.name,
      assistantId: data.assistantId,
      phoneNumberId: data.phoneNumberId,
      customers: data.customers.map((c) => ({
        number: c.number,
        ...(c.name ? { name: c.name } : {}),
      })),
      ...(schedulePlan ? { schedulePlan } : {}),
    };

    const res = (await vapiFetch("/campaign", {
      method: "POST",
      body: JSON.stringify(body),
    })) as VapiCampaignRaw;
    return mapCampaign(res);
  });

export const endVapiCampaign = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return { id: input.id };
  })
  .handler(async ({ data }): Promise<VapiCampaignDTO> => {
    const res = (await vapiFetch(`/campaign/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ended" }),
    })) as VapiCampaignRaw;
    return mapCampaign(res);
  });

export const deleteVapiCampaign = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return { id: input.id };
  })
  .handler(async ({ data }) => {
    await vapiFetch(`/campaign/${data.id}`, { method: "DELETE" });
    return { ok: true };
  });

// Diagnóstico: chamadas geradas por uma campanha, com motivo de encerramento.
export interface CampaignCallDTO {
  id: string;
  customerNumber: string | null;
  status: string | null;
  endedReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
  durationSec: number;
  answered: boolean;
  assistantSpoke: boolean;
  assistantId: string | null;
  phoneNumberId: string | null;
  fromNumber: string | null;
  source: "campanha" | "teste";
}

export interface CampaignDiagnosticsDTO {
  calls: CampaignCallDTO[];
  // Última ligação avulsa (teste manual) da mesma assistente, para comparação.
  reference: CampaignCallDTO | null;
}

export const listCampaignCalls = createServerFn({ method: "POST" })
  .middleware([withVapiCredentials])
  .inputValidator((input: { campaignId: string }) => {
    if (!input?.campaignId) throw new Error("campaignId é obrigatório");
    return { campaignId: input.campaignId };
  })
  .handler(async ({ data }): Promise<CampaignDiagnosticsDTO> => {
    const toList = (res: unknown) =>
      (Array.isArray(res)
        ? res
        : ((res as { results?: unknown[] } | null)?.results ?? [])) as Array<
        Record<string, unknown>
      >;

    // A Vapi nem sempre aceita ?campaignId no GET /call (400). Tenta e cai para
    // a listagem recente filtrada localmente.
    const recent = toList(await vapiFetch(`/call?limit=100`, { method: "GET" }));
    let list = recent.filter((c) => c["campaignId"] === data.campaignId);
    if (list.length === 0) {
      try {
        list = toList(
          await vapiFetch(`/call?campaignId=${encodeURIComponent(data.campaignId)}&limit=50`, {
            method: "GET",
          }),
        );
      } catch {
        list = [];
      }
    }

    // Assistente usada pela campanha: serve para achar a ligação de teste
    // equivalente (mesma assistente, fora de campanha).
    const campaignAssistantId = list
      .map((c) => (typeof c["assistantId"] === "string" ? (c["assistantId"] as string) : null))
      .find(Boolean) as string | undefined;

    const referenceRaw =
      campaignAssistantId != null
        ? recent.find(
            (c) => !c["campaignId"] && c["assistantId"] === campaignAssistantId && c["endedAt"],
          )
        : undefined;

    const fetchDetail = async (c: Record<string, unknown>) => {
      const id = String(c["id"] ?? "");
      if (!id) return c;
      try {
        const full = (await vapiFetch(`/call/${id}`, { method: "GET" })) as Record<
          string,
          unknown
        > | null;
        return full ? { ...c, ...full } : c;
      } catch {
        return c;
      }
    };

    // A listagem não traz `messages`; busca o detalhe das primeiras chamadas
    // para saber se a assistente chegou a falar.
    const detailed = await Promise.all(list.slice(0, 20).map(fetchDetail));
    const referenceDetailed = referenceRaw ? await fetchDetail(referenceRaw) : null;

    // Resolve o número E.164 de origem de cada phoneNumberId (cache local).
    const numberCache = new Map<string, string | null>();
    const resolveFrom = async (phoneNumberId: string | null) => {
      if (!phoneNumberId) return null;
      if (numberCache.has(phoneNumberId)) return numberCache.get(phoneNumberId) ?? null;
      let value: string | null = null;
      try {
        const pn = (await vapiFetch(`/phone-number/${phoneNumberId}`, {
          method: "GET",
        })) as { number?: string; name?: string } | null;
        value = pn?.number ?? pn?.name ?? null;
      } catch {
        value = null;
      }
      numberCache.set(phoneNumberId, value);
      return value;
    };

    const mapCall = async (
      c: Record<string, unknown>,
      source: "campanha" | "teste",
    ): Promise<CampaignCallDTO> => {
      const startedAt = typeof c["startedAt"] === "string" ? (c["startedAt"] as string) : null;
      const endedAt = typeof c["endedAt"] === "string" ? (c["endedAt"] as string) : null;
      const artifact = (c["artifact"] ?? {}) as { messages?: unknown; transcript?: unknown };
      const messages = (
        Array.isArray(c["messages"])
          ? c["messages"]
          : Array.isArray(artifact.messages)
            ? artifact.messages
            : []
      ) as Array<Record<string, unknown>>;
      const transcript =
        typeof c["transcript"] === "string"
          ? (c["transcript"] as string)
          : typeof artifact.transcript === "string"
            ? artifact.transcript
            : "";
      const customer = (c["customer"] ?? {}) as { number?: string };
      const phoneNumberId =
        typeof c["phoneNumberId"] === "string" ? (c["phoneNumberId"] as string) : null;
      const inlineFrom = (c["phoneNumber"] ?? {}) as { number?: string };
      return {
        id: String(c["id"] ?? ""),
        customerNumber: customer.number ?? null,
        status: typeof c["status"] === "string" ? (c["status"] as string) : null,
        endedReason: typeof c["endedReason"] === "string" ? (c["endedReason"] as string) : null,
        startedAt,
        endedAt,
        createdAt: typeof c["createdAt"] === "string" ? (c["createdAt"] as string) : null,
        durationSec:
          startedAt && endedAt
            ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000))
            : 0,
        // `startedAt` só existe quando a Vapi considerou a chamada conectada.
        answered: Boolean(startedAt),
        assistantSpoke:
          messages.some(
            (m) =>
              (m["role"] === "bot" || m["role"] === "assistant") &&
              typeof m["message"] === "string" &&
              (m["message"] as string).trim().length > 0,
          ) || /(^|\n)\s*ai:/i.test(transcript),
        assistantId: typeof c["assistantId"] === "string" ? (c["assistantId"] as string) : null,
        phoneNumberId,
        fromNumber: inlineFrom.number ?? (await resolveFrom(phoneNumberId)),
        source,
      };
    };

    const calls: CampaignCallDTO[] = [];
    for (const c of detailed) calls.push(await mapCall(c, "campanha"));
    const reference = referenceDetailed ? await mapCall(referenceDetailed, "teste") : null;

    return { calls, reference };
  });


