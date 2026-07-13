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
  if (!_client) {
    throw new Error(
      "Supabase browser client not initialized. Ensure __root.tsx loader runs first.",
    );
  }
  return _client;
}
