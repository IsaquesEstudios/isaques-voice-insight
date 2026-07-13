// Vapi pricing table (USD per minute) — static reference.
// Baseado na página pública https://vapi.ai/pricing (revisar periodicamente).
// Última revisão: 2026-07.
// Os valores aqui são estimativas médias considerando um assistente conversacional
// (~150 tokens/min entrada + ~150 tokens/min saída para LLM, e ~150 caracteres/min
// falados para TTS). Servem apenas para orientar a escolha do modelo.

export const VAPI_PLATFORM_FEE_PER_MIN = 0.05;
export const STT_COST_PER_MIN = 0.02; // Deepgram Nova (padrão Vapi)

// LLM cost per minute (USD) estimado
export const MODEL_PRICING: Record<string, Record<string, number>> = {
  openai: {
    "gpt-4o": 0.06,
    "gpt-4o-mini": 0.006,
    "gpt-4": 0.18,
    "gpt-3.5-turbo": 0.008,
  },
  anthropic: {
    "claude-3-5-sonnet-20241022": 0.09,
    "claude-3-haiku-20240307": 0.008,
  },
  google: {
    "gemini-1.5-pro": 0.05,
    "gemini-1.5-flash": 0.004,
  },
  groq: {
    "llama-3.1-70b-versatile": 0.01,
    "mixtral-8x7b-32768": 0.008,
  },
};

// TTS cost per minute (USD) — varia mais por provider do que por voz específica.
export const VOICE_PRICING: Record<string, Record<string, number>> = {
  "11labs": {
    _default: 0.12,
  },
  cartesia: {
    _default: 0.08,
  },
  openai: {
    _default: 0.015,
  },
  azure: {
    _default: 0.016,
  },
};

export function getModelCost(provider?: string, model?: string): number | null {
  if (!provider || !model) return null;
  const bucket = MODEL_PRICING[provider];
  if (!bucket) return null;
  const v = bucket[model];
  return typeof v === "number" ? v : null;
}

export function getVoiceCost(provider?: string, voiceId?: string): number | null {
  if (!provider) return null;
  const bucket = VOICE_PRICING[provider];
  if (!bucket) return null;
  if (voiceId && typeof bucket[voiceId] === "number") return bucket[voiceId];
  return typeof bucket._default === "number" ? bucket._default : null;
}

export function formatUSDPerMin(value: number | null): string {
  if (value === null) return "—";
  const digits = value < 0.1 ? 3 : 2;
  return `$${value.toFixed(digits)}/min`;
}
