import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { StubPage } from "@/components/dashboard/stub-page";

export const Route = createFileRoute("/crm")({
  head: () => ({ meta: [{ title: "CRM & Leads — Isaques Estúdios | AI Voice" }] }),
  component: () => (
    <DashboardShell>
      <StubPage
        icon={Inbox}
        title="CRM & Leads"
        description="Caixa de entrada unificada dos leads qualificados."
      />
    </DashboardShell>
  ),
});
