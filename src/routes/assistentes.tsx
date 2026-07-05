import { createFileRoute } from "@tanstack/react-router";
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

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistentes")({
  head: () => ({
    meta: [{ title: "Assistentes Virtuais — Isaques Estúdios | AI Voice" }],
  }),
  component: AssistentesPage,
});

type AssistantStatus = "Ativo" | "Rascunho" | "Pausado";

interface Assistant {
  name: string;
  role: string;
  voice: string;
  language: string;
  calls: number;
  successRate: number;
  avgDuration: string;
  status: AssistantStatus;
  updated: string;
  gradient: string;
}

const assistants: Assistant[] = [
  {
    name: "Sofia • SDR",
    role: "Qualificação de leads inbound",
    voice: "PT-BR • Feminina • Nova",
    language: "Português (BR)",
    calls: 2841,
    successRate: 87,
    avgDuration: "03:12",
    status: "Ativo",
    updated: "há 2h",
    gradient: "from-primary/40 to-primary/5",
  },
  {
    name: "Ricardo • Cobrança",
    role: "Recuperação de faturas em atraso",
    voice: "PT-BR • Masculina • Onyx",
    language: "Português (BR)",
    calls: 1520,
    successRate: 72,
    avgDuration: "02:47",
    status: "Ativo",
    updated: "há 5h",
    gradient: "from-chart-2/40 to-chart-2/5",
  },
  {
    name: "Marina • Agendamentos",
    role: "Marcação de consultas médicas",
    voice: "PT-BR • Feminina • Shimmer",
    language: "Português (BR)",
    calls: 984,
    successRate: 91,
    avgDuration: "01:58",
    status: "Ativo",
    updated: "há 1d",
    gradient: "from-chart-3/40 to-chart-3/5",
  },
  {
    name: "Diego • Pós-venda",
    role: "Pesquisa de satisfação (NPS)",
    voice: "PT-BR • Masculina • Echo",
    language: "Português (BR)",
    calls: 412,
    successRate: 68,
    avgDuration: "02:11",
    status: "Pausado",
    updated: "há 3d",
    gradient: "from-chart-4/40 to-chart-4/5",
  },
  {
    name: "Bianca • Recepção",
    role: "Atendimento de chamadas 24/7",
    voice: "PT-BR • Feminina • Alloy",
    language: "Português (BR)",
    calls: 3211,
    successRate: 94,
    avgDuration: "01:34",
    status: "Ativo",
    updated: "há 12min",
    gradient: "from-chart-5/40 to-chart-5/5",
  },
  {
    name: "Bruno • Vendas B2B",
    role: "Prospecção outbound corporativa",
    voice: "PT-BR • Masculina • Fable",
    language: "Português (BR)",
    calls: 128,
    successRate: 0,
    avgDuration: "—",
    status: "Rascunho",
    updated: "há 6h",
    gradient: "from-primary/30 to-chart-2/10",
  },
];

const statusStyles: Record<AssistantStatus, string> = {
  Ativo: "bg-success/15 text-success",
  Rascunho: "bg-muted text-muted-foreground",
  Pausado: "bg-chart-3/15 text-chart-3",
};

function AssistentesPage() {
  const total = assistants.length;
  const active = assistants.filter((a) => a.status === "Ativo").length;
  const totalCalls = assistants.reduce((sum, a) => sum + a.calls, 0);
  const avgSuccess = Math.round(
    assistants.filter((a) => a.successRate > 0).reduce((s, a) => s + a.successRate, 0) /
      assistants.filter((a) => a.successRate > 0).length,
  );

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
            { label: "Assistentes", value: total, icon: Bot },
            { label: "Ativos agora", value: active, icon: Zap },
            { label: "Ligações (30d)", value: totalCalls.toLocaleString("pt-BR"), icon: MessageSquare },
            { label: "Taxa média", value: `${avgSuccess}%`, icon: Clock },
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
          {assistants.map((a) => (
            <Card
              key={a.name}
              className="group relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
                  a.gradient,
                )}
                aria-hidden
              />
              <CardContent className="relative space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/60 text-primary backdrop-blur-xl">
                      <Mic className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.role}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", statusStyles[a.status])}>
                    {a.status}
                  </span>
                  <span className="text-muted-foreground">{a.voice}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Ligações
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {a.calls.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Sucesso
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {a.successRate > 0 ? `${a.successRate}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Duração
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{a.avgDuration}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Atualizado {a.updated}
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
