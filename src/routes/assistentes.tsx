import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pencil,
  Copy,
  Mic,
  Zap,
  Clock,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listVapiAssistants, type VapiAssistantDTO } from "@/lib/vapi.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistentes")({
  head: () => ({
    meta: [{ title: "Assistentes Virtuais — Isaques Estúdios | AI Voice" }],
  }),
  component: AssistentesPage,
});

type AssistantStatus = "Ativo" | "Rascunho" | "Pausado";

type VapiAssistant = VapiAssistantDTO;

const gradients = [
  "from-primary/40 to-primary/5",
  "from-chart-2/40 to-chart-2/5",
  "from-chart-3/40 to-chart-3/5",
  "from-chart-4/40 to-chart-4/5",
  "from-chart-5/40 to-chart-5/5",
  "from-primary/30 to-chart-2/10",
];

const statusStyles: Record<AssistantStatus, string> = {
  Ativo: "bg-success/15 text-success",
  Rascunho: "bg-muted text-muted-foreground",
  Pausado: "bg-chart-3/15 text-chart-3",
};

// Mocked performance metrics kept until the metrics API is wired.
function mockMetrics(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const calls = 200 + (h % 3200);
  const success = 60 + (h % 36);
  const secs = 60 + (h % 240);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const statuses: AssistantStatus[] = ["Ativo", "Ativo", "Ativo", "Pausado", "Rascunho"];
  const status = statuses[h % statuses.length];
  return {
    calls,
    successRate: status === "Rascunho" ? 0 : success,
    avgDuration: status === "Rascunho" ? "—" : `${mm}:${ss}`,
    status,
    updatedAgo: `há ${1 + (h % 48)}h`,
  };
}

function formatVoice(a: VapiAssistant) {
  const provider = a.voice?.provider;
  const voiceId = a.voice?.voiceId;
  if (provider && voiceId) return `${provider} • ${voiceId}`;
  if (voiceId) return voiceId;
  if (provider) return provider;
  return "Voz não configurada";
}

function AssistentesPage() {
  const fetchAssistants = useServerFn(listVapiAssistants);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAssistants();
        if (!cancelled) setAssistants(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        toast.error("Não foi possível carregar os assistentes da Vapi.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchAssistants]);
    };
  }, []);

  const enriched = useMemo(
    () =>
      assistants.map((a, i) => ({
        raw: a,
        gradient: gradients[i % gradients.length],
        metrics: mockMetrics(a.id ?? String(i)),
      })),
    [assistants],
  );

  const total = enriched.length;
  const active = enriched.filter((a) => a.metrics.status === "Ativo").length;
  const totalCalls = enriched.reduce((s, a) => s + a.metrics.calls, 0);
  const withRate = enriched.filter((a) => a.metrics.successRate > 0);
  const avgSuccess = withRate.length
    ? Math.round(withRate.reduce((s, a) => s + a.metrics.successRate, 0) / withRate.length)
    : 0;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Assistentes Virtuais
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie, edite e monitore seus agentes de voz.
            </p>
          </div>
          <Button className="gap-2 shadow-glow">
            <Plus className="h-4 w-4" />
            Novo Assistente
          </Button>
        </div>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Assistentes", value: isLoading ? "—" : total, icon: Bot },
            { label: "Ativos agora", value: isLoading ? "—" : active, icon: Zap },
            {
              label: "Ligações (30d)",
              value: isLoading ? "—" : totalCalls.toLocaleString("pt-BR"),
              icon: MessageSquare,
            },
            { label: "Taxa média", value: isLoading ? "—" : `${avgSuccess}%`, icon: Clock },
          ].map((k) => (
            <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <k.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar assistentes..."
              className="border-white/[0.08] bg-card/20 pl-9 backdrop-blur-xl"
            />
          </div>
          {["Todos", "Ativos", "Rascunhos", "Pausados"].map((f, i) => (
            <Button
              key={f}
              variant={i === 0 ? "default" : "outline"}
              size="sm"
              className={cn(
                i !== 0 &&
                  "border-white/[0.08] bg-card/20 backdrop-blur-xl hover:bg-primary/10 hover:text-primary",
              )}
            >
              {f}
            </Button>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <AssistantSkeleton key={i} />)
            : enriched.length === 0
              ? (
                <Card className="col-span-full border-white/[0.08] bg-card/20 backdrop-blur-2xl">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum assistente encontrado na sua conta Vapi.
                  </CardContent>
                </Card>
              )
              : enriched.map(({ raw, gradient, metrics }) => (
                  <Card
                    key={raw.id}
                    className="group relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
                        gradient,
                      )}
                      aria-hidden
                    />
                    <CardContent className="relative space-y-4 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/60 text-primary backdrop-blur-xl">
                            <Mic className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {raw.name?.trim() || "Assistente Sem Nome"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              ID: {raw.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-semibold",
                            statusStyles[metrics.status],
                          )}
                        >
                          {metrics.status}
                        </span>
                        <span className="truncate text-muted-foreground">{formatVoice(raw)}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Ligações
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {metrics.calls.toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Sucesso
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {metrics.successRate > 0 ? `${metrics.successRate}%` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Duração
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {metrics.avgDuration}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          Atualizado {metrics.updatedAgo}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
        </section>
      </div>
    </DashboardShell>
  );
}

function AssistantSkeleton() {
  return (
    <Card className="relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl bg-white/10" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14 rounded-full bg-white/10" />
          <Skeleton className="h-3 w-32 bg-white/10" />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-14 bg-white/10" />
              <Skeleton className="h-3.5 w-12 bg-white/10" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24 bg-white/10" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
            <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
            <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
