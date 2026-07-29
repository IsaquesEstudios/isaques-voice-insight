import { createFileRoute, redirect, isRedirect, Outlet } from "@tanstack/react-router";
import { getPublicSupabaseConfig } from "@/integrations/supabase/config.functions";
import { getSupabaseBrowser, initSupabaseBrowser } from "@/integrations/supabase/browser";
import { getSetupStatus } from "@/lib/vapi.functions";

async function ensureSupabaseBrowser() {
  try {
    return getSupabaseBrowser();
  } catch {
    const cfg = await getPublicSupabaseConfig();
    return initSupabaseBrowser(cfg.url, cfg.anonKey);
  }
}

// Cache do status de setup: evita um roundtrip ao servidor a cada navegação.
let setupCache: { ok: boolean; at: number } | null = null;
const SETUP_TTL = 5 * 60_000;

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
    // Onboarding gate: exige apenas a Vapi. A telefonia (Nvoip) pode ser
    // concluída depois — nesse caso o painel mostra a barra de alerta.
    if (location.pathname !== "/onboarding") {
      const fresh = setupCache && Date.now() - setupCache.at < SETUP_TTL;
      if (fresh) {
        if (!setupCache!.ok) throw redirect({ to: "/onboarding" });
      } else {
        try {
          const status = await getSetupStatus();
          setupCache = { ok: Boolean(status.vapi), at: Date.now() };
          if (!setupCache.ok) {
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

