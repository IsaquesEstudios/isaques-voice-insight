import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { StubPage } from "@/components/dashboard/stub-page";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico de Chamadas — Isaques Estúdios | AI Voice" }] }),
  component: () => (
    <DashboardShell>
      <StubPage
        icon={ListChecks}
        title="Histórico de Chamadas"
        description="Logs completos, transcrições e áudios das interações."
      />
    </DashboardShell>
  ),
});
