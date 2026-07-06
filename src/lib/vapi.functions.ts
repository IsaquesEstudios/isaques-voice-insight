import { createServerFn } from "@tanstack/react-start";

export interface VapiAssistantDTO {
  id: string;
  name?: string | null;
  voice?: { provider?: string; voiceId?: string } | null;
  model?: { provider?: string; model?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export const listVapiAssistants = createServerFn({ method: "GET" }).handler(
  async (): Promise<VapiAssistantDTO[]> => {
    const key = process.env.VAPI_PRIVATE_KEY;
    if (!key) {
      throw new Error("VAPI_PRIVATE_KEY não configurada no servidor");
    }

    const res = await fetch("https://api.vapi.ai/assistant", {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Vapi API error", res.status, body);
      throw new Error(`Vapi retornou ${res.status}`);
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];

    // Return only safe, minimal fields to the client.
    return (data as VapiAssistantDTO[]).map((a) => ({
      id: a.id,
      name: a.name ?? null,
      voice: a.voice
        ? { provider: a.voice.provider, voiceId: a.voice.voiceId }
        : null,
      model: a.model
        ? { provider: a.model.provider, model: a.model.model }
        : null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  },
);
