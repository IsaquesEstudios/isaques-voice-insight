import { createFileRoute } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { StubPage } from "@/components/dashboard/stub-page";

export const Route = createFileRoute("/telefonia")({
  head: () => ({ meta: [{ title: "Telefonia & Números — Isaques Estúdios | AI Voice" }] }),
  component: () => (
    <DashboardShell>
      <StubPage
        icon={PhoneCall}
        title="Telefonia & Números"
        description="Gestão de rotas, DIDs e políticas anti-spam."
      />
    </DashboardShell>
  ),
});
