import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  PhoneCall,
  ShieldCheck,
  AlertTriangle,
  Globe2,
  MoreVertical,
  Circle,
  Signal,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/telefonia")({
  head: () => ({
    meta: [{ title: "Telefonia & Números — Isaques Estúdios | AI Voice" }],
  }),
  component: TelefoniaPage,
});

type Health = "Seguro" | "Descanso" | "Risco";

interface NumberRow {
  number: string;
  region: string;
  provider: "Twilio" | "Vonage";
  assistant: string;
  callsToday: number;
  answerRate: number;
  health: Health;
}

const numbers: NumberRow[] = [
  { number: "+55 11 4200-1101", region: "São Paulo / SP", provider: "Twilio", assistant: "Sofia • SDR", callsToday: 214, answerRate: 88, health: "Seguro" },
  { number: "+55 21 4200-2244", region: "Rio de Janeiro / RJ", provider: "Twilio", assistant: "Ricardo • Cobrança", callsToday: 178, answerRate: 62, health: "Descanso" },
  { number: "+55 31 4200-3378", region: "Belo Horizonte / MG", provider: "Vonage", assistant: "Marina • Agendamentos", callsToday: 90, answerRate: 91, health: "Seguro" },
  { number: "+55 41 4200-4487", region: "Curitiba / PR", provider: "Twilio", assistant: "Bianca • Recepção", callsToday: 322, answerRate: 79, health: "Seguro" },
  { number: "+55 51 4200-5591", region: "Porto Alegre / RS", provider: "Vonage", assistant: "Ricardo • Cobrança", callsToday: 41, answerRate: 24, health: "Risco" },
  { number: "+55 11 4200-6620", region: "São Paulo / SP", provider: "Twilio", assistant: "—", callsToday: 0, answerRate: 0, health: "Descanso" },
];

const healthStyles: Record<Health, string> = {
  Seguro: "bg-success/15 text-success",
  Descanso: "bg-chart-3/15 text-chart-3",
  Risco: "bg-destructive/15 text-destructive",
};

const routes = [
  { name: "Rota Comercial SP", numbers: 8, load: 74, status: "Ativo" },
  { name: "Rota Cobrança Nacional", numbers: 12, load: 58, status: "Ativo" },
  { name: "Rota Recepção 24/7", numbers: 4, load: 92, status: "Ativo" },
  { name: "Rota Sandbox", numbers: 2, load: 12, status: "Pausado" },
];

function TelefoniaPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Telefonia & Números
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão de rotas, DIDs e políticas anti-spam.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl">
              <Globe2 className="h-4 w-4" /> Nova Rota
            </Button>
            <Button className="gap-2 shadow-glow">
              <Plus className="h-4 w-4" /> Adquirir número
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Números ativos", value: "26", icon: PhoneCall, tone: "text-primary" },
            { label: "Seguros", value: "19", icon: ShieldCheck, tone: "text-success" },
            { label: "Em descanso", value: "5", icon: Signal, tone: "text-chart-3" },
            { label: "Risco de spam", value: "2", icon: AlertTriangle, tone: "text-destructive" },
          ].map((k) => (
            <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                </div>
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-background/60", k.tone)}>
                  <k.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Números (DIDs)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="px-6">Número</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Assistente</TableHead>
                      <TableHead>Hoje</TableHead>
                      <TableHead>Atendimento</TableHead>
                      <TableHead>Saúde</TableHead>
                      <TableHead className="px-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numbers.map((n) => (
                      <TableRow
                        key={n.number}
                        className="border-border/50 transition-colors hover:bg-primary/5"
                      >
                        <TableCell className="px-6">
                          <p className="font-mono text-xs font-medium text-foreground">{n.number}</p>
                          <p className="text-[10px] text-muted-foreground">{n.provider}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{n.region}</TableCell>
                        <TableCell className="text-xs text-foreground">{n.assistant}</TableCell>
                        <TableCell className="text-xs">{n.callsToday}</TableCell>
                        <TableCell className="text-xs">
                          {n.answerRate > 0 ? `${n.answerRate}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              healthStyles[n.health],
                            )}
                          >
                            <Circle className="h-1.5 w-1.5 fill-current" />
                            {n.health}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Rotas ativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {routes.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{r.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "Ativo"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.numbers} números vinculados
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          r.load > 85 ? "bg-destructive" : r.load > 60 ? "bg-chart-3" : "bg-primary",
                        )}
                        style={{ width: `${r.load}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{r.load}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
