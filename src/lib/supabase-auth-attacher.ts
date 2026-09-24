import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";

// Anexa o token do Supabase externo em todas as chamadas de server functions.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const client = getSupabaseBrowser();
    let { data } = await client.auth.getSession();
    const expiraEm = data.session?.expires_at ?? 0;
    // Sessão vencida (ou quase): renova antes de enviar, senão o servidor recusa o token.
    if (data.session && expiraEm * 1000 - Date.now() < 60_000) {
      const renovada = await client.auth.refreshSession();
      if (renovada.error || !renovada.data.session) {
        await client.auth.signOut();
        if (typeof window !== "undefined") window.location.assign("/auth");
      }
      data = { session: renovada.data.session } as typeof data;
    }
    const token = data.session?.access_token;
    try {
      return await next({
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      if (typeof window !== "undefined" && msg.startsWith("Unauthorized")) {
        // Token recusado pelo servidor (sessão revogada/inválida): tenta renovar;
        // se não der, encerra a sessão e leva ao login em vez de quebrar a tela.
        const renovada = await client.auth.refreshSession().catch(() => null);
        if (!renovada || renovada.error || !renovada.data.session) {
          await client.auth.signOut().catch(() => {});
          window.location.assign("/auth");
          return new Promise<never>(() => {});
        }
      }
      throw erro;
    }
  },
);
