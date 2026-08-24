import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from "@livekit/components-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { startLivekitCall, type LivekitCallSession } from "@/lib/livekit.functions";
import { translateError } from "@/lib/error-messages";

/** mm:ss da duração da chamada de teste. */
function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Status = "idle" | "connecting" | "in_call" | "ended" | "error";

interface Props {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatLivekitError(error: unknown): string {
  const detail = translateError(error, "erro desconhecido ao conectar.");
  const raw = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();

  if (raw.includes("microphone") || raw.includes("notallowederror") || raw.includes("permission")) {
    return [
      "Problema: o navegador bloqueou o microfone.",
      "Como resolver: clique no cadeado da barra de endereço, libere o microfone e tente de novo.",
    ].join("\n");
  }
  if (raw.includes("não configurado") || raw.includes("livekit_url")) {
    return [
      "Problema: as credenciais do LiveKit não estão configuradas no servidor.",
      "Como resolver: confira LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET nas configurações do projeto.",
    ].join("\n");
  }
  return [
    "Problema: a chamada de teste não pôde ser iniciada.",
    `Motivo provável: ${detail}`,
    "Como resolver: verifique se o worker do agente está rodando no seu projeto LiveKit e tente novamente.",
  ].join("\n");
}

/** Controles da chamada — precisam viver dentro do <LiveKitRoom> (contexto). */
function SessionControls({
  muted,
  onMutedChange,
  onEnd,
}: {
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onEnd: () => void;
}) {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(!muted).catch(() => {
      /* noop */
    });
  }, [muted, localParticipant]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onMutedChange(!muted)}
        className="gap-2 border-border bg-card/40 backdrop-blur-xl"
      >
        {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {muted ? "Desmutar" : "Mutar"}
      </Button>
      <Button variant="destructive" size="sm" onClick={onEnd} className="gap-2">
        <PhoneOff className="h-4 w-4" />
        Encerrar
      </Button>
    </>
  );
}

export function LivekitCallDialog({ agentId, agentName, open, onOpenChange }: Props) {
  const startCallFn = useServerFn(startLivekitCall);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [session, setSession] = useState<LivekitCallSession | null>(null);
  const [muted, setMuted] = useState(false);
  const [costAck, setCostAck] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Token usado de fato na sala (evita reconectar durante rerenders).
  const sessionRef = useRef<LivekitCallSession | null>(null);

  const sessionMutation = useMutation({
    mutationFn: () => startCallFn({ data: { agentId } }),
  });

  // Reset completo ao fechar.
  useEffect(() => {
    if (!open) {
      sessionRef.current = null;
      setSession(null);
      setStatus("idle");
      setErrorMsg(null);
      setMuted(false);
      setCostAck(false);
      setElapsed(0);
    }
  }, [open]);

  // Cronômetro da chamada.
  useEffect(() => {
    if (status !== "in_call") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  async function startCall() {
    setStatus("connecting");
    setErrorMsg(null);
    setElapsed(0);

    // 1. Permissão de microfone primeiro — falha rápido e clara.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const msg = formatLivekitError(e);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      return;
    }

    // 2. Pede ao servidor a sala + token (agente entra por dispatch automático).
    try {
      const res = await sessionMutation.mutateAsync();
      sessionRef.current = res;
      setSession(res);
    } catch (e) {
      const msg = formatLivekitError(e);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
    }
  }

  function endCall() {
    sessionRef.current = null;
    setSession(null);
    setStatus("ended");
  }

  const isActive = status === "connecting" || status === "in_call";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Testar agente LiveKit
          </DialogTitle>
          <DialogDescription>
            Fale com <span className="font-semibold">{agentName}</span> usando o
            microfone do navegador. O agente entra na sala automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-foreground/[0.04] p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  status === "in_call" && "animate-pulse bg-success",
                  status === "connecting" && "animate-pulse bg-warning",
                  (status === "idle" || status === "ended") && "bg-muted",
                  status === "error" && "bg-destructive",
                )}
              />
              <p className="text-sm font-semibold">
                {status === "idle" && "Pronto para iniciar"}
                {status === "connecting" && "Conectando..."}
                {status === "in_call" && "Em ligação"}
                {status === "ended" && "Chamada encerrada"}
                {status === "error" && "Erro na chamada"}
              </p>
            </div>
            {(status === "in_call" || status === "ended") && (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums",
                  elapsed >= 60
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-background/40 text-muted-foreground",
                )}
                title={
                  elapsed >= 60
                    ? "Você passou de 1 minuto — encerre para evitar custos extras."
                    : "Duração do teste"
                }
              >
                {formatElapsed(elapsed)}
              </span>
            )}
          </div>

          {!isActive && status !== "error" && (
            <Alert className="border-warning/40 bg-warning/10">
              <DollarSign className="h-4 w-4 text-warning" />
              <AlertDescription className="space-y-2 text-xs leading-relaxed text-foreground">
                <p className="font-semibold">
                  Atenção: este teste pode ter custo real (LiveKit + provedores de voz/IA).
                </p>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  <li>A chamada consome minutos da sua infraestrutura LiveKit.</li>
                  <li>
                    Recomendação: <span className="font-semibold text-foreground">não ultrapasse 1 minuto</span> de teste.
                  </li>
                </ul>
                <label className="flex cursor-pointer items-start gap-2 pt-1 text-foreground">
                  <Checkbox
                    checked={costAck}
                    onCheckedChange={(v) => setCostAck(v === true)}
                    className="mt-0.5"
                  />
                  <span>Entendi e assumo o custo deste teste.</span>
                </label>
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && errorMsg && (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertDescription className="whitespace-pre-line text-xs leading-relaxed text-foreground">
                {errorMsg}
              </AlertDescription>
            </Alert>
          )}

          {/* Sala LiveKit: montada apenas quando há token. RoomAudioRenderer
              é obrigatório para o áudio do agente tocar no navegador. */}
          {session && (
            <LiveKitRoom
              token={session.token}
              serverUrl={session.serverUrl}
              connect={true}
              audio={true}
              video={false}
              onConnected={() => setStatus("in_call")}
              onDisconnected={() => {
                sessionRef.current = null;
                setSession(null);
                setStatus((s) => (s === "error" ? s : "ended"));
              }}
              onError={(e) => {
                const msg = formatLivekitError(e);
                setStatus("error");
                setErrorMsg(msg);
                toast.error("Erro na chamada", { description: msg.split("\n")[0] });
              }}
            >
              <RoomAudioRenderer />
              <div className="hidden">
                <MicControl muted={muted} onMutedChange={setMuted} />
              </div>
            </LiveKitRoom>
          )}

          <div className="flex items-center justify-between gap-2">
            <div>
              {session && status === "in_call" && (
                <MicControl muted={muted} onMutedChange={setMuted} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isActive ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={endCall}
                  disabled={status === "connecting"}
                  className="gap-2"
                >
                  {status === "connecting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneOff className="h-4 w-4" />
                  )}
                  Encerrar
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void startCall()}
                  disabled={!costAck && status !== "error"}
                  className="gap-2 shadow-glow"
                >
                  <PhoneCall className="h-4 w-4" />
                  {status === "error" ? "Tentar novamente" : "Iniciar chamada"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
