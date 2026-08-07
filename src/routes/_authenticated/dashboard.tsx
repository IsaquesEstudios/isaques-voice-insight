import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CircleDollarSign,
  Clock,
  HeartPulse,
  PhoneCall,
  RefreshCw,
  UserCheck,
} from "lucide-react";

import { CallsAreaChart } from "@/components/dashboard/calls-area-chart";
import { CostBreakdownCard } from "@/components/dashboard/cost-breakdown-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentCallsTable } from "@/components/dashboard/recent-calls-table";
import { DashboardShell } from "@/components/dashboard/shell";
import { TopAssistantsCard } from "@/components/dashboard/top-assistants-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDashboardOverview } from "@/lib/vapi.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard de Voz | Visão geral da operação" },
      {
        name: "description",
        content:
          "Acompanhe ligações, custos, taxa de atendimento e leads qualificados da sua operação de voz em tempo real.",
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

const money = (v: number) =>
  `$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function DashboardPage() {
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getDashboardOverview);
  const [rangeDays, setRangeDays] = useState(30);

  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: ["dashboard-overview", rangeDays],
    queryFn: () => fetchOverview({ data: { rangeDays } }),
    staleTime: 60_000,
  });

  const loading = isPending;
  const totals = data?.totals;

  const durationLabel =
    totals?.avgDurationSec != null && totals.avgDurationSec > 0
      ? `${Math.floor(totals.avgDurationSec / 60)}m ${Math.round(totals.avgDurationSec % 60)}s`
      : "—";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Visão Geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitore a saúde da operação de voz com dados reais da Vapi.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border/60 bg-card/60 text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Atualizar
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Não foi possível carregar os dados da Vapi. Verifique sua chave em Configurações.
          </div>
        ) : data?.error ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            {data.error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total de Ligações"
            value={(totals?.calls ?? 0).toLocaleString("pt-BR")}
            delta={data?.deltas.calls ?? null}
            hint={
              totals ? `${totals.outbound} outbound • ${totals.inbound} inbound` : "Outbound + Inbound"
            }
            icon={PhoneCall}
            loading={loading}
          />
          <MetricCard
            label="Custos da Operação"
            value={money(totals?.cost ?? 0)}
            delta={data?.deltas.cost ?? null}
            hint={totals ? `${totals.minutes.toFixed(0)} minutos falados` : "Vapi + Telefonia"}
            icon={CircleDollarSign}
            loading={loading}
          />
          <MetricCard
            label="Leads Qualificados"
            value={(totals?.qualified ?? 0).toLocaleString("pt-BR")}
            delta={data?.deltas.qualified ?? null}
            hint="Avaliação de sucesso positiva"
            icon={UserCheck}
            loading={loading}
          />
          <MetricCard
            label="Taxa de Atendimento"
            value={totals?.answerRate != null ? `${totals.answerRate.toFixed(1)}%` : "—"}
            delta={data?.deltas.answerRate ?? null}
            deltaSuffix=" p.p."
            hint={totals ? `${totals.answered} chamadas atendidas` : "Health Score"}
            icon={HeartPulse}
            loading={loading}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CallsAreaChart data={data?.daily ?? []} loading={loading} rangeDays={rangeDays} />
          </div>
          <div className="lg:col-span-1">
            <CostBreakdownCard
              breakdown={data?.costBreakdown ?? { stt: 0, llm: 0, tts: 0, vapi: 0, transport: 0 }}
              total={totals?.cost ?? 0}
              loading={loading}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TopAssistantsCard items={data?.topAssistants ?? []} loading={loading} />
          </div>
          <div className="lg:col-span-2">
            <MetricRow
              durationLabel={durationLabel}
              reasons={data?.endedReasons ?? []}
              loading={loading}
            />
          </div>
        </section>

        <section>
          <RecentCallsTable
            rows={data?.recent ?? []}
            loading={loading}
            onSeeAll={() => navigate({ to: "/historico" })}
          />
        </section>
      </div>
    </DashboardShell>
  );
}

const REASON_LABELS: Record<string, string> = {
  "customer-ended-call": "Cliente encerrou",
  "assistant-ended-call": "IA encerrou",
  "customer-did-not-answer": "Não atendeu",
  voicemail: "Caixa postal",
  "assistant-forwarded-call": "Transferido",
  "silence-timed-out": "Silêncio",
  "customer-busy": "Ocupado",
  "exceeded-max-duration": "Duração máxima",
};

function MetricRow({
  durationLabel,
  reasons,
  loading,
}: {
  durationLabel: string;
  reasons: Array<{ reason: string; count: number }>;
  loading?: boolean;
}) {
  const max = reasons.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <div className="h-full rounded-xl border border-border bg-card/20 p-5 backdrop-blur-2xl">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Como as chamadas terminam</h2>
          <p className="text-xs text-muted-foreground">
            Duração média por chamada: <span className="text-foreground">{durationLabel}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-foreground/[0.04]" />
          ))
        ) : reasons.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum encerramento registrado no período.
          </p>
        ) : (
          reasons.map((r) => (
            <div key={r.reason} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{REASON_LABELS[r.reason] ?? r.reason}</span>
                <span className="font-semibold text-foreground">{r.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.04]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${max > 0 ? (r.count / max) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
