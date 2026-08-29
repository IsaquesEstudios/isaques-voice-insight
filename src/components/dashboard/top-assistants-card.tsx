import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TopAssistantsCardProps {
  items: Array<{ id: string; name: string; calls: number; cost: number; minutes: number }>;
  loading?: boolean;
}

export function TopAssistantsCard({ items, loading }: TopAssistantsCardProps) {
  return (
    <Card className="h-full border-border bg-card/20 backdrop-blur-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Assistentes Mais Ativos</CardTitle>
            <p className="text-xs text-muted-foreground">Ranking por volume de chamadas</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl bg-foreground/[0.04]" />
          ))
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum assistente com chamadas no período.
          </p>
        ) : (
          items.map((a, i) => (
            <Link
              key={a.id}
              to="/assistentes"

              className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.04] p-3 transition-colors hover:border-primary/30 hover:bg-foreground/[0.04]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.calls} chamadas • {a.minutes.toFixed(0)} min • ${a.cost.toFixed(2)}
                </p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
