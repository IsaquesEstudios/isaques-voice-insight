// Server-only helpers to read the external Supabase project's env vars.
// These are set via add_secret under the MY_SUPABASE_* prefix (the SUPABASE_
// prefix is reserved by the Lovable platform for the managed integration).

export function getServerSupabaseUrl(): string {
  const url = process.env.MY_SUPABASE_URL;
  if (!url) throw new Error("MY_SUPABASE_URL is not configured");
  return url;
}

export function getServerSupabaseAnonKey(): string {
  const key = process.env.MY_SUPABASE_ANON_KEY;
  if (!key) throw new Error("MY_SUPABASE_ANON_KEY is not configured");
  return key;
}

export function getServerSupabaseServiceRoleKey(): string {
  const key = process.env.MY_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("MY_SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}
