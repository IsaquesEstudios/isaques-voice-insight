import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { StubPage } from "@/components/dashboard/stub-page";

export const Route = createFileRoute("/assistentes")({
  head: () => ({ meta: [{ title: "Assistentes Virtuais — Isaques Estúdios | AI Voice" }] }),
  component: () => (
    <DashboardShell>
      <StubPage
        icon={Bot}
        title="Assistentes Virtuais"
        description="Crie, edite e monitore seus agentes de voz."
      />
    </DashboardShell>
  ),
});
