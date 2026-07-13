import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSupabaseBrowser } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // Session lives in browser localStorage — skip SSR gating to avoid loops.
  ssr: false,
  beforeLoad: async () => {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
