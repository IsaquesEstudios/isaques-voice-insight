import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Filter,
  Star,
  Mail,
  Phone,
  Building2,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [{ title: "CRM & Leads — Omniasyn" }],
  }),
  component: CrmPage,
});

interface Lead {
  name: string;
  company: string;
  phone: string;
  email: string;
  score: number;
  stage: Stage;
  assistant: string;
  lastContact: string;
  value: string;
}

type Stage = "Novo" | "Qualificando" | "Reunião" | "Proposta" | "Ganho" | "Perdido";

const leads: Lead[] = [
  { name: "Ana Beatriz", company: "Studio Nova", phone: "+55 11 98421-0091", email: "ana@studionova.com", score: 9, stage: "Reunião", assistant: "Sofia • SDR", lastContact: "há 12min", value: "R$ 8.400" },
  { name: "Carlos Menezes", company: "Menezes Adv.", phone: "+55 21 99180-4477", email: "carlos@menezes.adv.br", score: 8, stage: "Proposta", assistant: "Bruno • Vendas B2B", lastContact: "há 1h", value: "R$ 14.200" },
  { name: "Fernanda Lira", company: "Clínica Vitalis", phone: "+55 31 98812-2210", email: "fernanda@vitalis.com", score: 7, stage: "Qualificando", assistant: "Marina", lastContact: "há 3h", value: "R$ 3.900" },
  { name: "Rafael Souza", company: "TechFlow", phone: "+55 41 99722-5510", email: "rafael@techflow.io", score: 10, stage: "Ganho", assistant: "Sofia • SDR", lastContact: "há 5h", value: "R$ 22.000" },
  { name: "Juliana Prado", company: "Prado & Cia", phone: "+55 11 98130-6721", email: "ju@pradocia.com", score: 5, stage: "Novo", assistant: "Bianca", lastContact: "há 8h", value: "—" },
  { name: "Marcos Vieira", company: "Vieira Imóveis", phone: "+55 51 98444-9021", email: "marcos@vieira.com", score: 3, stage: "Perdido", assistant: "Ricardo", lastContact: "ontem", value: "R$ 0" },
];

const stages: { key: Stage; count: number; color: string }[] = [
  { key: "Novo", count: 42, color: "bg-muted text-muted-foreground" },
  { key: "Qualificando", count: 28, color: "bg-chart-2/15 text-chart-2" },
  { key: "Reunião", count: 14, color: "bg-primary/15 text-primary" },
  { key: "Proposta", count: 9, color: "bg-chart-4/15 text-chart-4" },
  { key: "Ganho", count: 22, color: "bg-success/15 text-success" },
  { key: "Perdido", count: 11, color: "bg-destructive/15 text-destructive" },
];

function CrmPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">CRM & Leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pipeline unificado gerado pelas conversas dos seus assistentes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-border bg-card/20 backdrop-blur-xl">
              <Filter className="h-4 w-4" /> Filtros
            </Button>
            <Button className="gap-2 shadow-glow">
              <Plus className="h-4 w-4" /> Novo lead
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {stages.map((s) => (
            <Card
              key={s.key}
              className="border-border bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
            >
              <CardContent className="p-4">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", s.color)}>
                  {s.key}
                </span>
                <p className="mt-2 text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-[11px] text-muted-foreground">leads</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-border bg-card/20 backdrop-blur-2xl lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold">Leads recentes</CardTitle>
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar lead..."
                  className="h-8 border-border bg-background/40 pl-8 text-xs backdrop-blur-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {leads.map((l) => (
                <div
                  key={l.email}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-foreground/[0.04] p-3 backdrop-blur-xl transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-semibold text-sm">
                    {l.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{l.name}</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-chart-3/15 px-1.5 py-0.5 text-[10px] font-semibold text-chart-3">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        {l.score}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {l.company}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" /> {l.phone}
                      </span>
                      <span className="hidden md:inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {l.email}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-semibold text-foreground">{l.value}</p>
                    <p className="text-[10px] text-muted-foreground">{l.lastContact}</p>
                  </div>
                  <span
                    className={cn(
                      "hidden sm:inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      stages.find((s) => s.key === l.stage)?.color,
                    )}
                  >
                    {l.stage}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card/20 backdrop-blur-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Performance do funil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Taxa de qualificação", value: 68, delta: "+4,2%" },
                { label: "Conversão em reunião", value: 41, delta: "+1,8%" },
                { label: "Fechamento", value: 27, delta: "-0,6%" },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      {m.value}%
                      <span
                        className={cn(
                          "text-[10px]",
                          m.delta.startsWith("+") ? "text-success" : "text-destructive",
                        )}
                      >
                        {m.delta}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${m.value}%` }} />
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-primary">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-semibold">Meta do mês</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-foreground">R$ 148,2K</p>
                <p className="text-[11px] text-muted-foreground">
                  74% da meta • faltam R$ 51,8K
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
