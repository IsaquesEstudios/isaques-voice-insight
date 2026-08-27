import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";

// Anexa o token do Supabase externo em todas as chamadas de server functions.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await getSupabaseBrowser().auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
