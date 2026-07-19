// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Pré-empacota o SDK da Vapi via esbuild para evitar o bug "Class extends
    // value #<Object> is not a constructor or null" no Rolldown ao herdar de
    // EventEmitter no navegador.
    optimizeDeps: {
      include: ["@vapi-ai/web", "events"],
    },
    resolve: {
      alias: [
        {
          find: /^events$/,
          replacement: fileURLToPath(new URL("./src/lib/events-shim.ts", import.meta.url)),
        },
      ],
    },
    build: {
      rolldownOptions: {
        output: {
          strictExecutionOrder: true,
        },
      },
    },
  },
});
