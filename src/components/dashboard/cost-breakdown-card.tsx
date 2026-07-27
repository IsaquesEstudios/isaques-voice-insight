import { PieChart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CostBreakdownCardProps {
  breakdown: { stt: number; llm: number; tts: number; vapi: number; transport: number };
  total: number;
  loading?: boolean;
}

const ITEMS: Array<{ key: keyof CostBreakdownCardProps["breakdown"]; label: string; bar: string; dot: string }> = [
  { key: "llm", label: "Modelo (LLM)", bar: "bg-primary", dot: "bg-primary" },
  { key: "tts", label: "Voz (TTS)", bar: "bg-chart-2", dot: "bg-chart-2" },
  { key: "stt", label: "Transcrição (STT)", bar: "bg-chart-3", dot: "bg-chart-3" },
  { key: "vapi", label: "Plataforma Vapi", bar: "bg-chart-4", dot: "bg-chart-4" },
  { key: "transport", label: "Telefonia", bar: "bg-chart-5", dot: "bg-chart-5" },
];

export function CostBreakdownCard({ breakdown, total, loading }: CostBreakdownCardProps) {
  const sum = ITEMS.reduce((acc, i) => acc + (breakdown[i.key] || 0), 0);
  return (
    <Card className="h-full border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Composição de Custos</CardTitle>
            <p className="text-xs text-muted-foreground">Onde o dinheiro está sendo gasto</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32 bg-white/10" />
              <Skeleton className="h-2 w-full bg-white/10" />
            </div>
          ))
        ) : sum <= 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem custos registrados no período.
          </p>
        ) : (
          <>
            {ITEMS.map((item) => {
              const value = breakdown[item.key] || 0;
              const pct = sum > 0 ? (value / sum) * 100 : 0;
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", item.dot)} />
                      {item.label}
                    </span>
                    <span className="font-semibold text-foreground">
                      ${value.toFixed(2)}{" "}
                      <span className="font-normal text-muted-foreground">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={cn("h-full rounded-full", item.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Total no período:{" "}
                <span className="font-semibold text-foreground">${total.toFixed(2)}</span>
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
