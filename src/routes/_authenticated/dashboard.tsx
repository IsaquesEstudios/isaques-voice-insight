import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, HeartPulse, PhoneCall, UserCheck } from "lucide-react";
import { useState } from "react";

import { CallsAreaChart } from "@/components/dashboard/calls-area-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardShell } from "@/components/dashboard/shell";
import { TopAssistantsCard } from "@/components/dashboard/top-assistants-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard de Voz | Visão geral da operação" },
      {
        name: "description",
        content:
          "Acompanhe ligações, custos, taxa de atendimento e leads qualificados da sua operação de voz.",
      },
      { property: "og:title", content: "Dashboard de Voz | Visão geral da operação" },
      {
        property: "og:description",
        content: "Ligações, custos e performance dos seus assistentes de voz em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DashboardPage() {
  const [rangeDays, setRangeDays] = useState(30);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Visão Geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aguardando a conexão da sua plataforma de voz para exibir dados reais.
            </p>
          </div>
          <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
            <SelectTrigger className="h-9 w-[150px] border-border/60 bg-card/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total de Ligações"
            value="0"
            delta={null}
            hint="Outbound + Inbound"
            icon={PhoneCall}
          />
          <MetricCard
            label="Custos da Operação"
            value="$0,00"
            delta={null}
            hint="Sem provedor conectado"
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Leads Qualificados"
            value="0"
            delta={null}
            hint="Avaliação de sucesso positiva"
            icon={UserCheck}
          />
          <MetricCard
            label="Taxa de Atendimento"
            value="—"
            delta={null}
            hint="Health Score"
            icon={HeartPulse}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CallsAreaChart data={[]} rangeDays={rangeDays} />
          </div>
          <div className="lg:col-span-1">
            <TopAssistantsCard items={[]} />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
