import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  Filter,
  Search,
  Play,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
  Calendar,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [{ title: "Histórico de Chamadas — Isaques Estúdios | AI Voice" }],
  }),
  component: HistoricoPage,
});

type Direction = "inbound" | "outbound";
type Status = "Qualificado" | "Transferido" | "Caixa Postal" | "Sem resposta" | "Perdido";

interface Row {
  datetime: string;
  direction: Direction;
  phone: string;
  assistant: string;
  duration: string;
  cost: string;
  status: Status;
}

const rows: Row[] = [
  { datetime: "15/03 • 14:22", direction: "outbound", phone: "+55 11 98421-0091", assistant: "Sofia • SDR", duration: "03:42", cost: "R$ 1,84", status: "Qualificado" },
  { datetime: "15/03 • 13:58", direction: "inbound", phone: "+55 21 99180-4477", assistant: "Bianca", duration: "01:14", cost: "R$ 0,62", status: "Transferido" },
  { datetime: "15/03 • 13:31", direction: "outbound", phone: "+55 31 98812-2210", assistant: "Ricardo", duration: "00:38", cost: "R$ 0,31", status: "Caixa Postal" },
  { datetime: "15/03 • 12:47", direction: "inbound", phone: "+55 41 99722-5510", assistant: "Bianca", duration: "05:19", cost: "R$ 2,65", status: "Qualificado" },
  { datetime: "15/03 • 11:59", direction: "outbound", phone: "+55 11 98130-6721", assistant: "Sofia • SDR", duration: "02:03", cost: "R$ 1,02", status: "Transferido" },
  { datetime: "15/03 • 11:12", direction: "outbound", phone: "+55 51 98444-9021", assistant: "Ricardo", duration: "00:00", cost: "R$ 0,04", status: "Sem resposta" },
  { datetime: "15/03 • 10:42", direction: "outbound", phone: "+55 71 98111-0032", assistant: "Bruno", duration: "00:52", cost: "R$ 0,44", status: "Perdido" },
  { datetime: "15/03 • 09:18", direction: "inbound", phone: "+55 11 98110-0450", assistant: "Marina", duration: "04:11", cost: "R$ 2,08", status: "Qualificado" },
  { datetime: "14/03 • 18:04", direction: "outbound", phone: "+55 11 97711-8823", assistant: "Sofia • SDR", duration: "02:47", cost: "R$ 1,39", status: "Qualificado" },
  { datetime: "14/03 • 16:52", direction: "inbound", phone: "+55 21 98844-3312", assistant: "Bianca", duration: "01:33", cost: "R$ 0,77", status: "Transferido" },
];

const statusStyles: Record<Status, string> = {
  Qualificado: "bg-success/15 text-success",
  Transferido: "bg-chart-3/15 text-chart-3",
  "Caixa Postal": "bg-muted text-muted-foreground",
  "Sem resposta": "bg-chart-2/15 text-chart-2",
  Perdido: "bg-destructive/15 text-destructive",
};

function HistoricoPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Histórico de Chamadas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Logs completos, transcrições e áudios das interações.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl">
              <Calendar className="h-4 w-4" /> Últimos 7 dias
            </Button>
            <Button variant="outline" className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total (7d)", value: "12.847" },
            { label: "Duração média", value: "02:41" },
            { label: "Custo total", value: "R$ 6.094" },
            { label: "Qualificação", value: "23,4%" },
          ].map((k) => (
            <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold">Registros</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar telefone, assistente..."
                  className="h-8 border-white/[0.08] bg-background/40 pl-8 text-xs backdrop-blur-xl"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                <Filter className="h-3.5 w-3.5" /> Status
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="px-6">Data / Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Assistente</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="px-6 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow
                      key={i}
                      className="border-border/50 transition-colors hover:bg-primary/5"
                    >
                      <TableCell className="px-6 font-medium text-foreground">
                        {r.datetime}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            r.direction === "inbound"
                              ? "bg-chart-2/15 text-chart-2"
                              : "bg-primary/15 text-primary",
                          )}
                        >
                          {r.direction === "inbound" ? (
                            <PhoneIncoming className="h-3 w-3" />
                          ) : (
                            <PhoneOutgoing className="h-3 w-3" />
                          )}
                          {r.direction === "inbound" ? "Inbound" : "Outbound"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.phone}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">{r.assistant}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.duration}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.cost}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            statusStyles[r.status],
                          )}
                        >
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/15 hover:text-primary"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground hover:bg-primary/15 hover:text-primary"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Resumo
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
