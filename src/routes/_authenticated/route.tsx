import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSupabaseBrowser } from "@/integrations/supabase/client";
import { getSetupStatus } from "@/lib/vapi.functions";

export const Route = createFileRoute("/_authenticated")({
  // Session lives in browser localStorage — skip SSR gating to avoid loops.
  ssr: false,
  beforeLoad: async ({ location }) => {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // Onboarding gate: exige Vapi e Twilio configurados antes de acessar o app.
    if (location.pathname !== "/onboarding") {
      try {
        const status = await getSetupStatus();
        if (!status.vapi || !status.twilio) {
          throw redirect({ to: "/onboarding" });
        }
      } catch (e) {
        // Re-throw router redirects; swallow transient errors to avoid lockout.
        if (e && typeof e === "object" && "to" in (e as Record<string, unknown>)) throw e;
        console.error("setup status check failed", e);
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
