// Estado compartilhado do gate de onboarding.
// Fica fora do módulo de rota porque o code-splitting do TanStack remove
// runtime siblings dos arquivos de rota em produção.

const SETUP_TTL = 5 * 60_000;
const SKIP_SIP_KEY = "onboarding:skip-sip";

let setupCache: { ok: boolean; at: number } | null = null;

export function getSetupCache(): { ok: boolean; at: number } | null {
  if (!setupCache) return null;
  if (Date.now() - setupCache.at >= SETUP_TTL) return null;
  return setupCache;
}

export function setSetupCache(ok: boolean) {
  setupCache = { ok, at: Date.now() };
}

/** Limpa o cache do gate de onboarding (usar após salvar credenciais). */
export function resetSetupCache() {
  setupCache = null;
}

/** Marca que o usuário optou por pular o cadastro do tronco SIP. */
export function skipSipStep() {
  try {
    localStorage.setItem(SKIP_SIP_KEY, "1");
  } catch {
    /* ignore */
  }
  setupCache = null;
}

export function sipSkipped() {
  try {
    return localStorage.getItem(SKIP_SIP_KEY) === "1";
  } catch {
    return false;
  }
}
