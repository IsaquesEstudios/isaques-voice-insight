import { createServerFn } from "@tanstack/react-start";

// Returns the *public* Supabase config (URL + anon key) so the browser client
// can be initialized. These values are safe to expose to the client.
export const getPublicSupabaseConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getServerSupabaseUrl, getServerSupabaseAnonKey } = await import(
      "@/integrations/supabase/env.server"
    );
    return {
      url: getServerSupabaseUrl(),
      anonKey: getServerSupabaseAnonKey(),
    };
  },
);
