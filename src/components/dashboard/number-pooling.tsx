import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Health = "safe" | "rest" | "risk";

const numbers: { number: string; label: string; calls: number; health: Health }[] = [
  { number: "+55 11 4200-9832", label: "SP • Comercial", calls: 148, health: "safe" },
  { number: "+55 21 3900-1177", label: "RJ • Vendas", calls: 89, health: "rest" },
  { number: "+55 31 4020-5514", label: "MG • Retenção", calls: 212, health: "risk" },
];

const healthConfig: Record<Health, { label: string; dot: string; badge: string }> = {
  safe: {
    label: "Seguro",
    dot: "bg-success shadow-[0_0_12px] shadow-success/60",
    badge: "bg-success/15 text-success",
  },
  rest: {
    label: "Descanso",
    dot: "bg-warning shadow-[0_0_12px] shadow-warning/60",
    badge: "bg-warning/15 text-warning",
  },
  risk: {
    label: "Risco de Spam",
    dot: "bg-destructive shadow-[0_0_12px] shadow-destructive/60",
    badge: "bg-destructive/15 text-destructive",
  },
};

export function NumberPooling() {
  return (
    <Card className="h-full border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Status de Rotação</CardTitle>
            <p className="text-xs text-muted-foreground">Number Pooling — Anti-Spam</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {numbers.map((n) => {
          const cfg = healthConfig[n.health];
          return (
            <div
              key={n.number}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30 hover:bg-white/[0.06]"
            >
              <span className={cn("relative h-2.5 w-2.5 shrink-0 rounded-full", cfg.dot)}>
                <span
                  className={cn(
                    "absolute inset-0 animate-ping rounded-full opacity-60",
                    cfg.dot.split(" ")[0],
                  )}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{n.number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {n.label} • {n.calls} chamadas hoje
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  cfg.badge,
                )}
              >
                {cfg.label}
              </span>
            </div>
          );
        })}

        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] p-3 text-center backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">
            Rotação automática ativa. Próxima troca em <span className="text-foreground font-semibold">02:14h</span>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
