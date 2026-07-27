import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
  deltaSuffix?: string;
  compareLabel?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  loading,
  deltaSuffix = "%",
  compareLabel = "vs. período anterior",
}: MetricCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="group relative overflow-hidden border-white/[0.08] bg-card/20 p-5 backdrop-blur-2xl transition-all hover:border-primary/30 hover:shadow-glow">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:bg-primary/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-28 bg-white/10" />
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          )}
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2">
        {loading ? (
          <Skeleton className="h-5 w-40 bg-white/10" />
        ) : delta == null ? (
          <span className="text-xs text-muted-foreground">Sem base de comparação</span>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {positive ? "+" : ""}
              {delta.toFixed(1)}
              {deltaSuffix}
            </span>
            <span className="text-xs text-muted-foreground">{compareLabel}</span>
          </>
        )}
      </div>
    </Card>
  );
}
