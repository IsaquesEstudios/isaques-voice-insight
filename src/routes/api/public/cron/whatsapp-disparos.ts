import { createFileRoute } from "@tanstack/react-router";

// Endereço chamado pelo agendamento (pg_cron) para enviar campanhas e lembretes vencidos.
async function executar(request: Request) {
  const segredo = process.env["DISPAROS_CRON_SECRET"];
  if (!segredo) return new Response("Agendamento não configurado.", { status: 500 });

  const url = new URL(request.url);
  const enviado =
    request.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";
  if (enviado !== segredo) return new Response("Não autorizado", { status: 401 });

  const { processarPendentes } = await import("@/lib/whatsapp-disparos.server");
  const resultado = await processarPendentes();
  return new Response(JSON.stringify({ ok: true, ...resultado }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/cron/whatsapp-disparos")({
  server: {
    handlers: {
      GET: ({ request }) => executar(request),
      POST: ({ request }) => executar(request),
    },
  },
});
