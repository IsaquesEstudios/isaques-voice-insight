import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/dashboard/shell";
import { LivekitAgentsSection } from "@/components/assistants/livekit-agents-section";

export const Route = createFileRoute("/_authenticated/assistentes")({
  head: () => ({
    meta: [
      { title: "Assistentes Virtuais — Omniasyn" },
      {
        name: "description",
        content:
          "Crie e gerencie seus agentes de voz na infraestrutura Omniasyn (LiveKit).",
      },
      { property: "og:title", content: "Assistentes Virtuais — Omniasyn" },
      {
        property: "og:description",
        content: "Crie e gerencie seus agentes de voz na infraestrutura Omniasyn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistentesPage,
});

function AssistentesPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Assistentes Virtuais
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os agentes de voz da sua plataforma.
          </p>
        </div>

        <LivekitAgentsSection />
      </div>
    </DashboardShell>
  );
}
