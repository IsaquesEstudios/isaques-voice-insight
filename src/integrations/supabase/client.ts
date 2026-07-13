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
