import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { StubPage } from "@/components/dashboard/stub-page";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações / API — Isaques Estúdios | AI Voice" }] }),
  component: () => (
    <DashboardShell>
      <StubPage
        icon={Settings}
        title="Configurações / API"
        description="Chaves de API, integrações e preferências da conta."
      />
    </DashboardShell>
  ),
});
