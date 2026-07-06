import { createServerFn } from "@tanstack/react-start";

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
}

function getKey(): string {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("VAPI_PRIVATE_KEY não configurada no servidor");
  return key;
}

function buildPayload(input: AssistantInput) {
  return {
    name: input.name,
    firstMessage: input.firstMessage,
    model: {
      provider: "openai",
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: input.systemPrompt }],
    },
    voice: { provider: "11labs", voiceId: "burt" },
  };
}

async function vapiFetch(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Vapi API error", res.status, body);
    throw new Error(`Vapi ${init.method ?? "GET"} ${path} retornou ${res.status}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const listVapiAssistants = createServerFn({ method: "GET" }).handler(
  async (): Promise<VapiAssistantDTO[]> => {
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
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  },
);

export const getVapiAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data }): Promise<VapiAssistantRaw> => {
    const res = (await vapiFetch(`/assistant/${data.id}`, { method: "GET" })) as VapiAssistantRaw;
    return res;
  });

export const createVapiAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: AssistantInput) => {
    if (!input?.name?.trim()) throw new Error("Nome é obrigatório");
    return {
      name: input.name.trim(),
      firstMessage: input.firstMessage ?? "",
      systemPrompt: input.systemPrompt ?? "",
    };
  })
  .handler(async ({ data }): Promise<VapiAssistantRaw> => {
    return (await vapiFetch("/assistant", {
      method: "POST",
      body: JSON.stringify(buildPayload(data)),
    })) as VapiAssistantRaw;
  });

export const updateVapiAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: AssistantInput & { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    if (!input?.name?.trim()) throw new Error("Nome é obrigatório");
    return {
      id: input.id,
      name: input.name.trim(),
      firstMessage: input.firstMessage ?? "",
      systemPrompt: input.systemPrompt ?? "",
    };
  })
  .handler(async ({ data }): Promise<VapiAssistantRaw> => {
    const { id, ...rest } = data;
    return (await vapiFetch(`/assistant/${id}`, {
      method: "PATCH",
      body: JSON.stringify(buildPayload(rest)),
    })) as VapiAssistantRaw;
  });

export const deleteVapiAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await vapiFetch(`/assistant/${data.id}`, { method: "DELETE" });
    return { ok: true };
  });

// Duplicates an existing assistant by fetching its full config, stripping
// server-managed fields, and creating a new one with " - Cópia" appended.
export const duplicateVapiAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id é obrigatório");
    return input;
  })
  .handler(async ({ data }): Promise<VapiAssistantRaw> => {
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

    return (await vapiFetch("/assistant", {
      method: "POST",
      body: JSON.stringify(clone),
    })) as VapiAssistantRaw;
  });
