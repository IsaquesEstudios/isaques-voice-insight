import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { getSetupStatus } from "@/lib/vapi.functions";

/**
 * Barra fixa de alerta exibida quando o usuário optou por "concluir cadastro depois".
 * Enquanto a telefonia (Nvoip) não estiver conectada, as funções de chamada real
 * ficam indisponíveis.
 */
export function SetupBanner() {
  const status = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => getSetupStatus(),
    staleTime: 60_000,
  });

  if (!status.data || status.data.telefonia) return null;

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 md:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-xs text-warning-foreground sm:items-center">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning sm:mt-0" />
          <p>
            <span className="font-semibold">Cadastro incompleto:</span> conecte sua
            conta Nvoip (telefonia) para liberar chamadas reais, números e campanhas.
          </p>
        </div>
        <Link
          to="/onboarding"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground transition-opacity hover:opacity-90"
        >
          Finalizar registro <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
