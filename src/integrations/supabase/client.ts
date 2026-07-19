// Browser Supabase client. Initialized once at app boot from the config
// returned by getPublicSupabaseConfig (see src/routes/__root.tsx).
//
// Consumers MUST call initSupabaseBrowser first, or use useSupabase() from
// within the SupabaseProvider tree.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function initSupabaseBrowser(url: string, anonKey: string): SupabaseClient {
  if (_client) return _client;
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        if (res.status === 401 || res.status === 403) {
          try {
            const txt = await res.clone().text();
            if (/JWT issued at future|JWT expired|invalid JWT/i.test(txt)) {
              if (_client) await _client.auth.signOut().catch(() => {});
              if (typeof window !== "undefined") window.location.assign("/auth");
            }
          } catch {
            /* ignore */
          }
        }
        return res;
      },
    },
  });
  return _client;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;
  // Fallback de auto-init no browser: o loader de __root.tsx roda no servidor
  // durante SSR e o estado do módulo NÃO é transferido ao cliente na
  // hidratação inicial. Sem esse fallback, o beforeLoad de rotas filhas
  // (ex.: _authenticated) explode antes do RootComponent montar e chamar
  // initSupabaseBrowser. Usamos as VITE_* que já são embutidas no bundle.
  if (typeof window !== "undefined") {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (url && key) {
      return initSupabaseBrowser(url, key);
    }
  }
  throw new Error(
    "Supabase browser client not initialized. Ensure __root.tsx loader runs first.",
  );
}
