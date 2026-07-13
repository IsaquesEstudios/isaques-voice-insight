// Service-role Supabase client. RLS is BYPASSED. Server-only — do NOT import
// this module at the top level of a *.functions.ts file (route-reachable);
// load it dynamically inside handlers with `await import(...)`.

import { createClient } from "@supabase/supabase-js";
import {
  getServerSupabaseServiceRoleKey,
  getServerSupabaseUrl,
} from "./env.server";

export const supabaseAdmin = createClient(
  getServerSupabaseUrl(),
  getServerSupabaseServiceRoleKey(),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
