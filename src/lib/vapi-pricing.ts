// Vapi pricing & specs — só IDs documentados oficialmente pela Vapi.
// Fontes:
//   • docs.vapi.ai/providers/model/* (lista de provedores/modelos suportados)
//   • docs.vapi.ai/providers/voice/vapi-voices (vozes ativas + V2)
//   • docs.vapi.ai/providers/transcriber/deepgram (transcriber padrão)
//   • docs.vapi.ai/pricing (fee de plataforma + custo "at cost" dos providers)
// A Vapi cobra um fee fixo de $0.05/min + o custo do provider repassado "at cost".
// Não existe endpoint público de preço — os valores abaixo espelham as páginas
// oficiais de pricing/tokens de cada provider (revisão: 2026-07). Atualize à medida
// que os provedores mudarem os preços.

export const VAPI_PLATFORM_FEE_PER_MIN = 0.05;

export interface TranscriberSpec {
  provider: string;
  label: string;
  model: string;
  costPerMin: number;
  latencyMs: number;
  accuracyWer: number; // %
}

export interface ModelSpec {
  costPerMin: number;
  latencyMs: number;
  intelligence: number; // 1–5
}

export interface VoiceSpec {
  costPerMin: number;
  latencyMs: number;
  humanness: number | null; // 1–5
}

// Transcriber padrão oficial da Vapi para uso multilíngue (Nova 3 multi).
// Ref.: https://docs.vapi.ai/providers/transcriber/deepgram
export const DEFAULT_TRANSCRIBER: TranscriberSpec = {
  provider: "Deepgram",
  label: "Nova 3 Multi",
  model: "nova-3",
  costPerMin: 0.0077,
  latencyMs: 300,
  accuracyWer: 2.7,
};

// Transcribers oficialmente listados pela Vapi (dashboard values).
// Ref.: painel oficial da Vapi — https://dashboard.vapi.ai
export const TRANSCRIBER_SPECS: Record<string, Record<string, TranscriberSpec>> = {
  vapi: {
    "stt-rt-v5": {
      provider: "Vapi",
      label: "STT RT v5",
      model: "stt-rt-v5",
      costPerMin: 0.004,
      latencyMs: 300,
      accuracyWer: 1.8,
    },
  },
  deepgram: {
    "nova-3": DEFAULT_TRANSCRIBER,
  },
};

export function getTranscriberSpec(provider?: string, model?: string): TranscriberSpec | null {
  if (!provider || !model) return null;
  return TRANSCRIBER_SPECS[provider]?.[model] ?? null;
}


// Somente modelos listados em docs.vapi.ai/providers/model/*
export const MODEL_SPECS: Record<string, Record<string, ModelSpec>> = {
  openai: {
    "gpt-4.1": { costPerMin: 0.03, latencyMs: 650, intelligence: 16 },
    "gpt-4.1-mini": { costPerMin: 0.008, latencyMs: 500, intelligence: 13 },
    "gpt-4o": { costPerMin: 0.06, latencyMs: 700, intelligence: 15 },
    "gpt-4o-mini": { costPerMin: 0.006, latencyMs: 550, intelligence: 12 },
    "gpt-4.1-nano": { costPerMin: 0.01, latencyMs: 470, intelligence: 10 },
    "o3-mini": { costPerMin: 0.04, latencyMs: 900, intelligence: 16 },
  },
  anthropic: {
    "claude-3-5-sonnet-20241022": { costPerMin: 0.09, latencyMs: 780, intelligence: 15 },
    "claude-3-5-haiku-20241022": { costPerMin: 0.024, latencyMs: 560, intelligence: 12 },
    "claude-3-opus-20240229": { costPerMin: 0.45, latencyMs: 950, intelligence: 15 },
  },
  google: {
    "gemini-2.0-flash": { costPerMin: 0.008, latencyMs: 450, intelligence: 13 },
    "gemini-1.5-pro": { costPerMin: 0.05, latencyMs: 720, intelligence: 13 },
    "gemini-1.5-flash": { costPerMin: 0.004, latencyMs: 480, intelligence: 9 },
  },
  groq: {
    "llama-3.3-70b-versatile": { costPerMin: 0.012, latencyMs: 380, intelligence: 12 },
    "llama-3.1-8b-instant": { costPerMin: 0.003, latencyMs: 320, intelligence: 8 },
  },
  xai: {
    "grok-2": { costPerMin: 0.06, latencyMs: 700, intelligence: 13 },
  },
};

// Voice IDs oficialmente listados pela Vapi.
// vapi:     https://docs.vapi.ai/providers/voice/vapi-voices (Active Voices)
// openai:   https://docs.vapi.ai/providers/voice/openai
// deepgram: https://docs.vapi.ai/providers/voice/deepgram (Aura 2)
// Para 11labs/cartesia/playht os voiceIds são UUIDs específicos da conta (BYOK)
// e devem vir da dashboard do usuário — não listamos IDs aqui.
export const VOICE_SPECS: Record<string, Record<string, VoiceSpec>> = {
  vapi: {
    _default: { costPerMin: 0.02, latencyMs: 410, humanness: 95 },
    Elliot: { costPerMin: 0.02, latencyMs: 410, humanness: 95 },
    Savannah: { costPerMin: 0.02, latencyMs: 250, humanness: 70 },
    Emma: { costPerMin: 0.02, latencyMs: 260, humanness: 71 },
    Clara: { costPerMin: 0.02, latencyMs: 260, humanness: 71 },
    Nico: { costPerMin: 0.02, latencyMs: 250, humanness: 68 },
    Kai: { costPerMin: 0.02, latencyMs: 260, humanness: 70 },
    Rohan: { costPerMin: 0.02, latencyMs: 260, humanness: 66 },
    Sagar: { costPerMin: 0.02, latencyMs: 260, humanness: 68 },
    Godfrey: { costPerMin: 0.02, latencyMs: 260, humanness: 66 },
    Neil: { costPerMin: 0.02, latencyMs: 260, humanness: 68 },
    Layla: { costPerMin: 0.02, latencyMs: 260, humanness: 70 },
    Sid: { costPerMin: 0.02, latencyMs: 260, humanness: 68 },
    Naina: { costPerMin: 0.02, latencyMs: 260, humanness: 68 },
  },
  openai: {
    _default: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
    alloy: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
    echo: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
    fable: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
    onyx: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
    nova: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
    shimmer: { costPerMin: 0.015, latencyMs: 600, humanness: 55 },
  },
  deepgram: {
    _default: { costPerMin: 0.015, latencyMs: 300, humanness: 60 },
    "aura-2-thalia-en": { costPerMin: 0.015, latencyMs: 300, humanness: 62 },
    "aura-2-orion-en": { costPerMin: 0.015, latencyMs: 300, humanness: 60 },
    "aura-2-luna-en": { costPerMin: 0.015, latencyMs: 300, humanness: 62 },
    "aura-2-asteria-en": { costPerMin: 0.015, latencyMs: 300, humanness: 62 },
  },
  azure: {
    _default: { costPerMin: 0.016, latencyMs: 500, humanness: 55 },
  },
  "11labs": {
    _default: { costPerMin: 0.036, latencyMs: 1150, humanness: null },
  },
  cartesia: {
    _default: { costPerMin: 0.022, latencyMs: 300, humanness: null },
  },
  playht: {
    _default: { costPerMin: 0.024, latencyMs: 900, humanness: null },
  },
};

export const STT_COST_PER_MIN = DEFAULT_TRANSCRIBER.costPerMin;

export function getModelSpec(provider?: string, model?: string): ModelSpec | null {
  if (!provider || !model) return null;
  return MODEL_SPECS[provider]?.[model] ?? null;
}

export function getVoiceSpec(provider?: string, voiceId?: string): VoiceSpec | null {
  if (!provider) return null;
  const bucket = VOICE_SPECS[provider];
  if (!bucket) return null;
  if (voiceId && bucket[voiceId]) return bucket[voiceId];
  return bucket._default ?? null;
}

export function getModelCost(provider?: string, model?: string): number | null {
  return getModelSpec(provider, model)?.costPerMin ?? null;
}

export function getVoiceCost(provider?: string, voiceId?: string): number | null {
  return getVoiceSpec(provider, voiceId)?.costPerMin ?? null;
}

export function formatUSDPerMin(value: number | null): string {
  if (value === null) return "—";
  const digits = value < 0.1 ? 3 : 2;
  const factor = Math.pow(10, digits);
  const rounded = Math.ceil(value * factor) / factor;
  return `$${rounded.toFixed(digits)}/min`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(3).replace(/\.?0+$/, "")}s`.replace(".", ".");
  return `${Math.round(ms)}ms`;
}
