// Client-side functionMiddleware that attaches the current Supabase user's
// access token to every createServerFn call as `Authorization: Bearer ...`.

import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseBrowser } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") {
      return next();
    }

    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return next();

      return next({
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      return next();
    }
  },
);
