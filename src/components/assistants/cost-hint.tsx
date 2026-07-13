import { DollarSign, Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatUSDPerMin } from "@/lib/vapi-pricing";

interface CostHintProps {
  costPerMin: number | null;
  tooltip?: string;
  className?: string;
}

export function CostHint({ costPerMin, tooltip, className }: CostHintProps) {
  const unknown = costPerMin === null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-background/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-xl",
            !unknown && "text-foreground/80",
            className,
          )}
        >
          <DollarSign className="h-3 w-3 text-primary/70" />
          <span>~ {formatUSDPerMin(costPerMin)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        {unknown
          ? "Preço não catalogado para essa opção. Consulte vapi.ai/pricing."
          : (tooltip ?? "Estimativa baseada na tabela pública da Vapi. Custo real varia conforme uso.")}
      </TooltipContent>
    </Tooltip>
  );
}

interface CostSummaryProps {
  llm: number | null;
  tts: number | null;
  stt: number;
  platform: number;
  className?: string;
}

export function CostSummary({ llm, tts, stt, platform, className }: CostSummaryProps) {
  const parts = [llm, tts, stt, platform];
  const hasUnknown = parts.some((p) => p === null);
  const total = hasUnknown ? null : (parts as number[]).reduce((a, b) => a + b, 0);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs backdrop-blur-xl",
            className,
          )}
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-primary/70" />
            Custo estimado total
          </span>
          <span className="font-semibold text-foreground">
            ~ {formatUSDPerMin(total)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="min-w-[220px] text-xs">
        <div className="space-y-1">
          <Row label="LLM" value={llm} />
          <Row label="TTS (voz)" value={tts} />
          <Row label="STT (transcrição)" value={stt} />
          <Row label="Vapi platform" value={platform} />
          <div className="mt-1 border-t border-white/10 pt-1 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatUSDPerMin(total)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatUSDPerMin(value)}</span>
    </div>
  );
}
