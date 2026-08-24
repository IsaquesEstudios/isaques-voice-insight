import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async (opts) => {
  const { next } = opts;
  const request = (opts as { request?: Request }).request;
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // Chamadas RPC de server functions (/_serverFn/*) precisam do erro
    // serializado pelo TanStack — devolver HTML aqui faz o cliente rejeitar
    // com `undefined` ("Uncaught undefined" + tela branca).
    const isServerFn =
      request != null &&
      (new URL(request.url).pathname.startsWith("/_serverFn") ||
        request.headers.get("x-tsr-serverfn") === "true");
    if (isServerFn) {
      throw error;
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
