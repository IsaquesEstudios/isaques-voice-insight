import { Info, Mic, Cpu, Volume2 } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TRANSCRIBER,
  VAPI_PLATFORM_FEE_PER_MIN,
  formatUSDPerMin,
  getModelSpec,
  getVoiceSpec,
} from "@/lib/vapi-pricing";

interface Props {
  modelProvider: string;
  model: string;
  voiceProvider: string;
  voiceId: string;
  transcriber?: {
    provider: string;
    label: string;
    costPerMin: number;
    latencyMs: number;
    accuracyWer: number;
  };
}

// Cores fixas do dashboard Vapi para as três camadas + fee
const COLOR_TRANSCRIBER = "#22c55e"; // verde
const COLOR_MODEL = "#3b82f6";       // azul
const COLOR_VOICE = "#a855f7";       // roxo
const COLOR_PLATFORM = "#f97316";    // laranja (Vapi fee)

export function VapiStatsPanel({
  modelProvider,
  model,
  voiceProvider,
  voiceId,
  transcriber = DEFAULT_TRANSCRIBER,
}: Props) {
  const modelSpec = getModelSpec(modelProvider, model);
  const voiceSpec = getVoiceSpec(voiceProvider, voiceId);

  const costParts = [
    { label: "Vapi", value: VAPI_PLATFORM_FEE_PER_MIN, color: COLOR_PLATFORM },
    { label: "Transcriber", value: transcriber.costPerMin, color: COLOR_TRANSCRIBER },
    { label: "Model", value: modelSpec?.costPerMin ?? 0, color: COLOR_MODEL },
    { label: "Voice", value: voiceSpec?.costPerMin ?? 0, color: COLOR_VOICE },
  ];
  const costTotal = costParts.reduce((a, p) => a + p.value, 0);

  const latencyParts = [
    { label: "Transcriber", value: transcriber.latencyMs, color: COLOR_TRANSCRIBER },
    { label: "Model", value: modelSpec?.latencyMs ?? 0, color: COLOR_MODEL },
    { label: "Voice", value: voiceSpec?.latencyMs ?? 0, color: COLOR_VOICE },
  ];
  const latencyTotal = latencyParts.reduce((a, p) => a + p.value, 0);

  return (
    <div className="space-y-4">
      {/* Barras de custo e latência */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricBar
          label="Cost"
          tooltip="Custo estimado por minuto de chamada."
          formatted={`~${formatUSDPerMin(costTotal)}`}
          parts={costParts.map((p) => ({ ...p, tooltip: `${p.label}: ${formatUSDPerMin(p.value)}` }))}
          total={costTotal}
        />
        <MetricBar
          label="Latency"
          tooltip="Latência estimada ponta-a-ponta."
          formatted={`~${formatLatencyMs(latencyTotal)}`}
          parts={latencyParts.map((p) => ({ ...p, tooltip: `${p.label}: ${formatLatencyMs(p.value)}` }))}
          total={latencyTotal}
        />
      </div>

      {/* Três cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<Mic className="h-3.5 w-3.5" style={{ color: COLOR_TRANSCRIBER }} />}
          title="TRANSCRIBER"
          value={transcriber.label}
          providerLabel={transcriber.provider}
          providerColor={COLOR_TRANSCRIBER}
          rows={[
            { label: "Latency", value: formatLatencyMs(transcriber.latencyMs) },
            { label: "Cost", value: formatUSDPerMin(transcriber.costPerMin) },
            { label: "Accuracy", value: `${transcriber.accuracyWer}% WER` },
          ]}
        />
        <StatCard
          icon={<Cpu className="h-3.5 w-3.5" style={{ color: COLOR_MODEL }} />}
          title="MODEL"
          value={model || "—"}
          providerLabel={providerLabel(modelProvider)}
          providerColor={COLOR_MODEL}
          rows={[
            { label: "Latency", value: modelSpec ? formatLatencyMs(modelSpec.latencyMs) : "—" },
            { label: "Cost", value: formatUSDPerMin(modelSpec?.costPerMin ?? null) },
            {
              label: "Intelligence",
              value: modelSpec ? String(modelSpec.intelligence) : "—",
            },
          ]}
        />
        <StatCard
          icon={<Volume2 className="h-3.5 w-3.5" style={{ color: COLOR_VOICE }} />}
          title="VOICE"
          value={voiceId || "—"}
          providerLabel={providerLabel(voiceProvider)}
          providerColor={COLOR_VOICE}
          rows={[
            { label: "Latency", value: voiceSpec ? formatLatencyMs(voiceSpec.latencyMs) : "—" },
            { label: "Cost", value: formatUSDPerMin(voiceSpec?.costPerMin ?? null) },
            {
              label: "Humanness",
              value: voiceSpec?.humanness ? String(voiceSpec.humanness) : "—",
            },
          ]}
        />
      </div>
    </div>
  );
}

function MetricBar({
  label,
  tooltip,
  formatted,
  parts,
  total,
}: {
  label: string;
  tooltip: string;
  formatted: string;
  parts: { label: string; value: number; color: string; tooltip: string }[];
  total: number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-lg font-semibold text-foreground">
          {formatted}
          {label === "Cost" && <span className="ml-1 text-xs font-normal text-muted-foreground">/min</span>}
          {label === "Latency" && <span className="ml-1 text-xs font-normal text-muted-foreground">ms</span>}
        </span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          {parts.map((p, i) => {
            const pct = total > 0 ? (p.value / total) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: p.color }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {p.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  providerLabel,
  providerColor,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  providerLabel: string;
  providerColor: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-background/40 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: providerColor }}>
        {icon}
        {title}
      </div>
      <div className="mb-1 truncate text-base font-semibold text-foreground">{value}</div>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full")} style={{ backgroundColor: providerColor }} />
        {providerLabel}
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {r.label}
              <Info className="h-2.5 w-2.5" />
            </div>
            <div className="mt-0.5 text-xs font-medium text-foreground">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function providerLabel(p: string): string {
  const map: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    groq: "Groq",
    "11labs": "11labs",
    cartesia: "Cartesia",
    azure: "Azure",
  };
  return map[p] ?? p;
}

function formatLatencyMs(ms: number): string {
  if (ms >= 1000) {
    const s = (ms / 1000).toFixed(2).replace(/\.?0+$/, "");
    return `${s.replace(".", ".")}s`;
  }
  return `${Math.round(ms)}ms`;
}
