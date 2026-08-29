import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getPublicSupabaseConfig } from "@/integrations/supabase/config.functions";
import { getSupabaseBrowser, initSupabaseBrowser } from "@/integrations/supabase/browser";

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
    // Falhas ao inicializar o cliente (ex.: server fn retornando Response)
    // não podem virar "Uncaught undefined" / tela branca — mandamos ao login.
    let user;
    try {
      const supabase = await ensureSupabaseBrowser();
      // getSession() lê do localStorage (instantâneo); getUser() faria rede a cada navegação.
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData.session?.user;
    } catch (e) {
      console.error("auth bootstrap failed", e);
      throw redirect({ to: "/" });
    }
    if (!user) {
      throw redirect({ to: "/" });
    }

    return { user };
  },
  component: () => <Outlet />,
  errorComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta página. Tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Recarregar
      </button>
    </div>
  ),
});


