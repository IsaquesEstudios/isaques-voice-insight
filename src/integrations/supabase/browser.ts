// Browser Supabase client apontando para o projeto Supabase externo do cliente.
// A URL e a publishable key são públicas por definição (protegidas por RLS).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const DEFAULT_URL = "https://krumswystdvenzlbllbe.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_bJ384-YzI4xCUbTYJmnc0g_nizSXRQi";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // Chaves novas da Supabase são opacas, não são bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

let _client: SupabaseClient<Database> | undefined;
let _clientKey: string | undefined;

function build(url: string, anonKey: string): SupabaseClient<Database> {
  const key = `${url}::${anonKey}`;
  if (_client && _clientKey === key) return _client;

  _client = createClient<Database>(url, anonKey, {
    global: { fetch: createSupabaseFetch(anonKey) },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  _clientKey = key;
  return _client;
}

export function initSupabaseBrowser(url?: string, anonKey?: string) {
  return build(url || DEFAULT_URL, anonKey || DEFAULT_ANON_KEY);
}

export function getSupabaseBrowser() {
  return _client ?? build(DEFAULT_URL, DEFAULT_ANON_KEY);
}

// Compat: alguns módulos importam `supabase` diretamente.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    return Reflect.get(getSupabaseBrowser(), prop, receiver);
  },
});
