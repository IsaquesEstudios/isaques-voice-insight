// Server-function middleware that authenticates the current request against
// the external Supabase project using the bearer token attached by the
// client-side functionMiddleware (see src/integrations/supabase/auth-attacher.ts).

import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const authHeader = getRequestHeader("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      throw new Response("Unauthorized: No authorization header provided", {
        status: 401,
      });
    }

    const { getServerSupabaseUrl, getServerSupabaseAnonKey } = await import(
      "@/integrations/supabase/env.server"
    );

    // Publishable-key client scoped to this user's bearer token. RLS applies.
    const supabase = createClient(
      getServerSupabaseUrl(),
      getServerSupabaseAnonKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    );

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Response("Unauthorized: Invalid token", { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        user: data.user,
      },
    });
  },
);
