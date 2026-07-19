import { createFileRoute, redirect, isRedirect, Outlet } from "@tanstack/react-router";
import { getPublicSupabaseConfig } from "@/integrations/supabase/config.functions";
import { getSupabaseBrowser, initSupabaseBrowser } from "@/integrations/supabase/client";
import { getSetupStatus } from "@/lib/vapi.functions";

async function ensureSupabaseBrowser() {
  try {
    return getSupabaseBrowser();
  } catch {
    const cfg = await getPublicSupabaseConfig();
    return initSupabaseBrowser(cfg.url, cfg.anonKey);
  }
}

export const Route = createFileRoute("/_authenticated")({
  // Session lives in browser localStorage — skip SSR gating to avoid loops.
  ssr: false,
  beforeLoad: async ({ location }) => {
    const supabase = await ensureSupabaseBrowser();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/" });
    }
    // Onboarding gate: exige Vapi e Twilio configurados antes de acessar o app.
    if (location.pathname !== "/onboarding") {
      try {
        const status = await getSetupStatus();
        if (!status.vapi || !status.twilio) {
          throw redirect({ to: "/onboarding" });
        }
      } catch (e) {
        if (isRedirect(e)) throw e;
        console.error("setup status check failed", e);
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
