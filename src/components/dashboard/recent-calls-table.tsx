import { FileText, PhoneIncoming, PhoneOutgoing, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DashboardCallRow } from "@/lib/vapi.functions";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} • ${d.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function formatDuration(sec: number | null) {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const REASON_LABELS: Record<string, string> = {
  "customer-ended-call": "Cliente encerrou",
  "assistant-ended-call": "IA encerrou",
  "customer-did-not-answer": "Não atendeu",
  "voicemail": "Caixa postal",
  "assistant-forwarded-call": "Transferido",
  "silence-timed-out": "Silêncio",
  "customer-busy": "Ocupado",
  "exceeded-max-duration": "Duração máxima",
};

function statusInfo(row: DashboardCallRow) {
  if (row.successEvaluation === true) return { label: "Qualificado", cls: "bg-success/15 text-success" };
  const reason = row.endedReason ?? "";
  if (reason.includes("forward")) return { label: "Transferido", cls: "bg-chart-3/15 text-chart-3" };
  if (reason.includes("voicemail") || reason.includes("did-not-answer") || reason.includes("busy"))
    return { label: REASON_LABELS[reason] ?? "Não atendida", cls: "bg-muted text-muted-foreground" };
  if (reason.includes("error") || reason.includes("failed"))
    return { label: "Falha", cls: "bg-destructive/15 text-destructive" };
  return {
    label: REASON_LABELS[reason] ?? (row.status ? row.status : "Concluída"),
    cls: "bg-muted text-muted-foreground",
  };
}

interface RecentCallsTableProps {
  rows: DashboardCallRow[];
  loading?: boolean;
  onSeeAll?: () => void;
}

export function RecentCallsTable({ rows, loading, onSeeAll }: RecentCallsTableProps) {
  return (
    <Card className="border-border bg-card/20 backdrop-blur-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Chamadas Recentes</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Últimas interações da operação</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary"
          onClick={onSeeAll}
        >
          Ver todas
        </Button>
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
                <TableHead className="px-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j} className={j === 0 || j === 6 ? "px-6" : undefined}>
                        <Skeleton className="h-4 w-full max-w-[110px] bg-foreground/10" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-5 w-5 opacity-50" />
                    Nenhuma chamada registrada no período.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => {
                  const st = statusInfo(c);
                  return (
                    <TableRow key={c.id} className="border-border/50 transition-colors hover:bg-primary/5">
                      <TableCell className="px-6 font-medium text-foreground">
                        {formatDateTime(c.startedAt)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            c.direction === "inbound"
                              ? "bg-chart-2/15 text-chart-2"
                              : c.direction === "web"
                                ? "bg-chart-4/15 text-chart-4"
                                : "bg-primary/15 text-primary",
                          )}
                        >
                          {c.direction === "inbound" ? (
                            <PhoneIncoming className="h-3 w-3" />
                          ) : c.direction === "web" ? (
                            <Globe className="h-3 w-3" />
                          ) : (
                            <PhoneOutgoing className="h-3 w-3" />
                          )}
                          {c.direction === "inbound" ? "Inbound" : c.direction === "web" ? "Web" : "Outbound"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.phone ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                        {c.assistantName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDuration(c.durationSec)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.cost != null ? `$${c.cost.toFixed(3)}` : "—"}
                      </TableCell>
                      <TableCell className="px-6">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
                          {st.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
