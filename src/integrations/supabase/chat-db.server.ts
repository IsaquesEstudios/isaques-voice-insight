// Cliente do banco externo usado para guardar conversas e mensagens do WhatsApp.
// Service role: ignora RLS. Usar apenas dentro de handlers no servidor.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function build(): SupabaseClient {
  const url = process.env["MY_SUPABASE_URL"];
  const serviceKey = process.env["MY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new Error("Banco de dados externo não configurado (MY_SUPABASE_*).");
  }
  return createClient(url, serviceKey, {
    global: { fetch: createFetch(serviceKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _chatDb: SupabaseClient | undefined;

export const chatDb = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    if (!_chatDb) _chatDb = build();
    return Reflect.get(_chatDb, prop, receiver);
  },
});
