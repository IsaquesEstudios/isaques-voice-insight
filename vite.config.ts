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
    optimizeDeps: {
      include: ["@vapi-ai/web"],
    },
    resolve: {
      alias: {
        events: fileURLToPath(new URL("./src/lib/vapi-event-emitter-shim.ts", import.meta.url)),
      },
    },
    build: {
      // Workaround para bug do rolldown-vite 8.0.10+:
      // "Class extends value #<Object> is not a constructor or null"
      // Sem isso, classes que herdam de outras (EventEmitter no @vapi-ai/web)
      // acabam em chunks distintos e o pai fica em TDZ na hora de avaliar.
      // Ref: https://github.com/vitejs/vite/issues/22307
      rolldownOptions: {
        output: {
          strictExecutionOrder: true,
        },
      },
    },
  },
});

