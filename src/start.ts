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
    // Algumas bibliotecas rejeitam promises sem um valor (ou com um valor que
    // não é Error). Repassar isso literalmente faz o React receber
    // `Uncaught undefined`, sem stack, e desmontar a tela inteira.
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(
            typeof error === "string" && error.trim()
              ? error
              : "Falha inesperada durante a comunicação com o servidor.",
          );
    console.error(normalizedError);
    // Chamadas RPC de server functions (/_serverFn/*) precisam do erro
    // serializado pelo TanStack — devolver HTML aqui faz o cliente rejeitar
    // com `undefined` ("Uncaught undefined" + tela branca).
    const isServerFn =
      request != null &&
      (new URL(request.url).pathname.startsWith("/_serverFn") ||
        request.headers.get("x-tsr-serverfn") === "true");
    if (isServerFn) {
      throw normalizedError;
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
