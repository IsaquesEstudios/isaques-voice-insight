import { createFileRoute, redirect, isRedirect, Outlet } from "@tanstack/react-router";
import { getPublicSupabaseConfig } from "@/integrations/supabase/config.functions";
import { getSupabaseBrowser, initSupabaseBrowser } from "@/integrations/supabase/browser";
import { getSetupStatus } from "@/lib/vapi.functions";
import { getSetupCache, setSetupCache, sipSkipped } from "@/lib/setup-gate";

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
    // getSession() lê do localStorage (instantâneo); getUser() faria rede a cada navegação.
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      throw redirect({ to: "/" });
    }
    // Onboarding gate: exige a Vapi conectada e pelo menos um número cadastrado
    // (tronco SIP importado na conta Vapi do usuário).
    if (location.pathname !== "/onboarding") {
      const cached = getSetupCache();
      if (cached) {
        if (!cached.ok) throw redirect({ to: "/onboarding" });
      } else {
        try {
          const status = await getSetupStatus();
          const ok = Boolean(status.vapi && (status.sip || sipSkipped()));
          setSetupCache(ok);

          if (!ok) {
            throw redirect({ to: "/onboarding" });
          }
        } catch (e) {
          if (isRedirect(e)) throw e;
          console.error("setup status check failed", e);
        }
      }
    }

    return { user };
  },
  component: () => <Outlet />,
});

