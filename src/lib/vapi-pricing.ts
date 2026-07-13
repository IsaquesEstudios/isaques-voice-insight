// Vapi pricing & specs table — reflete os valores exibidos no dashboard oficial
// (https://vapi.ai). Última revisão: 2026-07. Ajuste conforme atualizações da Vapi.
//
// Cada modelo/voz/transcriber expõe:
//  - costPerMin  → custo estimado em USD/min
//  - latencyMs   → latência típica reportada pela Vapi
//  - accuracy    → (transcriber) WER em %
//  - intelligence→ (model) score 1–5 conforme Vapi
//  - humanness   → (voice) 1–5 conforme Vapi (null quando não catalogado)

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

// Transcriber padrão da Vapi (Deepgram Nova 3 General).
export const DEFAULT_TRANSCRIBER: TranscriberSpec = {
  provider: "Deepgram",
  label: "Nova 3 General",
  model: "nova-3",
  costPerMin: 0.01,
  latencyMs: 300,
  accuracyWer: 2.7,
};

export const MODEL_SPECS: Record<string, Record<string, ModelSpec>> = {
  openai: {
    "gpt-5": { costPerMin: 0.01, latencyMs: 550, intelligence: 17 },
    "gpt-4o": { costPerMin: 0.06, latencyMs: 700, intelligence: 15 },
    "gpt-4o-mini": { costPerMin: 0.006, latencyMs: 550, intelligence: 12 },
    "gpt-4": { costPerMin: 0.18, latencyMs: 900, intelligence: 15 },
    "gpt-3.5-turbo": { costPerMin: 0.01, latencyMs: 530, intelligence: 10 },
  },
  anthropic: {
    "claude-3-5-sonnet-20241022": { costPerMin: 0.09, latencyMs: 780, intelligence: 15 },
    "claude-3-haiku-20240307": { costPerMin: 0.008, latencyMs: 560, intelligence: 9 },
  },
  google: {
    "gemini-1.5-pro": { costPerMin: 0.05, latencyMs: 720, intelligence: 13 },
    "gemini-1.5-flash": { costPerMin: 0.004, latencyMs: 480, intelligence: 9 },
  },
  groq: {
    "llama-3.1-70b-versatile": { costPerMin: 0.01, latencyMs: 380, intelligence: 12 },
    "mixtral-8x7b-32768": { costPerMin: 0.008, latencyMs: 360, intelligence: 9 },
  },
};

export const VOICE_SPECS: Record<string, Record<string, VoiceSpec>> = {
  cartesia: {
    _default: { costPerMin: 0.022, latencyMs: 300, humanness: 69 },
    blake: { costPerMin: 0.022, latencyMs: 300, humanness: 69 },
  },
  "11labs": {
    _default: { costPerMin: 0.036, latencyMs: 1200, humanness: null },
    burt: { costPerMin: 0.036, latencyMs: 1200, humanness: null },
    rachel: { costPerMin: 0.036, latencyMs: 1150, humanness: 65 },
    adam: { costPerMin: 0.036, latencyMs: 1180, humanness: 62 },
    domi: { costPerMin: 0.036, latencyMs: 1160, humanness: 63 },
  },
  openai: {
    _default: { costPerMin: 0.015, latencyMs: 600, humanness: 50 },
  },
  azure: {
    _default: { costPerMin: 0.016, latencyMs: 500, humanness: 48 },
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
  return `$${value.toFixed(digits)}/min`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(3).replace(/\.?0+$/, "")}s`.replace(".", ".");
  return `${Math.round(ms)}ms`;
}
