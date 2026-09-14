import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env["META_WHATSAPP_VERIFY_TOKEN"];
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const appSecret = process.env["META_APP_SECRET"];
        const signature = request.headers.get("x-hub-signature-256");
        const body = await request.text();

        if (!appSecret || !signature?.startsWith("sha256=")) {
          return new Response("Invalid signature", { status: 401 });
        }
        const expected = createHmac("sha256", appSecret)
          .update(body)
          .digest("hex");
        const received = signature.slice("sha256=".length);
        if (
          received.length !== expected.length ||
          !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        // Evento válido da Meta. O processamento das mensagens é feito na página de conversas.
        console.log("whatsapp webhook", body.slice(0, 2000));
        return new Response("ok", { status: 200 });
      },
    },
  },
});
