import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface CallsChartPoint {
  label: string;
  inbound: number;
  outbound: number;
}

interface CallsAreaChartProps {
  data: CallsChartPoint[];
  loading?: boolean;
  rangeDays?: number;
}

export function CallsAreaChart({ data, loading, rangeDays = 30 }: CallsAreaChartProps) {
  const empty = !loading && data.every((d) => d.inbound === 0 && d.outbound === 0);
  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Volume de Ligações</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Comparativo Outbound vs Inbound — últimos {rangeDays} dias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" /> Outbound
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-chart-2" /> Inbound
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[280px] w-full">
          {loading ? (
            <Skeleton className="h-full w-full rounded-xl bg-white/[0.06]" />
          ) : empty ? (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-white/[0.08] text-sm text-muted-foreground">
              Nenhuma ligação registrada no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  minTickGap={16}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-primary)", strokeOpacity: 0.3 }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  name="Outbound"
                  dataKey="outbound"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#fillOut)"
                />
                <Area
                  type="monotone"
                  name="Inbound"
                  dataKey="inbound"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  fill="url(#fillIn)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
