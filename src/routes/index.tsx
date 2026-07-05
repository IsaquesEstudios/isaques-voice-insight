import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, HeartPulse, PhoneCall, UserCheck } from "lucide-react";

import { CallsAreaChart } from "@/components/dashboard/calls-area-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { NumberPooling } from "@/components/dashboard/number-pooling";
import { RecentCallsTable } from "@/components/dashboard/recent-calls-table";
import { DashboardShell } from "@/components/dashboard/shell";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Visão Geral
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitore a saúde da operação de voz em tempo real.
            </p>
          </div>
          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            Março 2025 • Atualizado agora
          </span>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total de Ligações"
            value="12.847"
            delta={13.6}
            hint="Outbound + Inbound"
            icon={PhoneCall}
          />
          <MetricCard
            label="Custos da Operação"
            value="R$ 6.094,90"
            delta={-3.2}
            hint="Vapi + Twilio"
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Leads Qualificados"
            value="1.284"
            delta={22.4}
            hint="Score ≥ 8"
            icon={UserCheck}
          />
          <MetricCard
            label="Taxa de Atendimento"
            value="94,2%"
            delta={1.8}
            hint="Health Score"
            icon={HeartPulse}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CallsAreaChart />
          </div>
          <div className="lg:col-span-1">
            <NumberPooling />
          </div>
        </section>

        <section>
          <RecentCallsTable />
        </section>
      </div>
    </DashboardShell>
  );
}
