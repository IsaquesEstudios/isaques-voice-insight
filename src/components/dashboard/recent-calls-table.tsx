import { FileText, PhoneIncoming, PhoneOutgoing, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Direction = "inbound" | "outbound";
type Status = "Transferido" | "Caixa Postal" | "Qualificado";

interface Call {
  datetime: string;
  direction: Direction;
  phone: string;
  duration: string;
  status: Status;
}

const calls: Call[] = [
  { datetime: "15/03 • 14:22", direction: "outbound", phone: "+55 11 98421-0091", duration: "03:42", status: "Qualificado" },
  { datetime: "15/03 • 13:58", direction: "inbound", phone: "+55 21 99180-4477", duration: "01:14", status: "Transferido" },
  { datetime: "15/03 • 13:31", direction: "outbound", phone: "+55 31 98812-2210", duration: "00:38", status: "Caixa Postal" },
  { datetime: "15/03 • 12:47", direction: "inbound", phone: "+55 41 99722-5510", duration: "05:19", status: "Qualificado" },
  { datetime: "15/03 • 11:59", direction: "outbound", phone: "+55 11 98130-6721", duration: "02:03", status: "Transferido" },
  { datetime: "15/03 • 10:42", direction: "outbound", phone: "+55 51 98444-9021", duration: "00:52", status: "Caixa Postal" },
  { datetime: "15/03 • 09:18", direction: "inbound", phone: "+55 11 98110-0450", duration: "04:11", status: "Qualificado" },
];

const statusStyles: Record<Status, string> = {
  Transferido: "bg-chart-3/15 text-chart-3",
  "Caixa Postal": "bg-muted text-muted-foreground",
  Qualificado: "bg-success/15 text-success",
};

export function RecentCallsTable() {
  return (
    <Card className="border-border/60 bg-card/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Chamadas Recentes</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Últimas interações da operação</p>
        </div>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
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
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="px-6 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((c, i) => (
                <TableRow
                  key={i}
                  className="border-border/50 transition-colors hover:bg-primary/5"
                >
                  <TableCell className="px-6 font-medium text-foreground">{c.datetime}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        c.direction === "inbound"
                          ? "bg-chart-2/15 text-chart-2"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {c.direction === "inbound" ? (
                        <PhoneIncoming className="h-3 w-3" />
                      ) : (
                        <PhoneOutgoing className="h-3 w-3" />
                      )}
                      {c.direction === "inbound" ? "Inbound" : "Outbound"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.duration}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        statusStyles[c.status],
                      )}
                    >
                      {c.status}
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
                        Ver Resumo
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
  );
}
