// Compat helpers around the generated Supabase browser client.
// The generated `supabase` export is already lazily initialized from env vars,
// so these helpers simply return it (the url/anonKey args are ignored).
import { supabase } from "./client";

export function initSupabaseBrowser(_url?: string, _anonKey?: string) {
  return supabase;
}

export function getSupabaseBrowser() {
  return supabase;
}
