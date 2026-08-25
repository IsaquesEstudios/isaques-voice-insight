import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useAudioPlayback,
  useLocalParticipant,
} from "@livekit/components-react";
import { Room, RoomEvent, Track } from "livekit-client";

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
  const errorName = error instanceof DOMException ? error.name.toLowerCase() : "";

  if (errorName === "notallowederror" || raw.includes("notallowederror") || raw.includes("permission denied")) {
    return [
      "Problema: o navegador bloqueou o microfone.",
      "Como resolver: se você acabou de liberar a permissão, recarregue esta página para aplicar a alteração. Caso contrário, clique no cadeado da barra de endereço e libere o microfone.",
    ].join("\n");
  }
  if (errorName === "notreadableerror" || errorName === "aborterror") {
    return [
      "Problema: o microfone está liberado, mas não pôde ser iniciado.",
      "Como resolver: feche outros aplicativos que possam estar usando o microfone, recarregue esta página e tente novamente.",
    ].join("\n");
  }
  if (errorName === "notfounderror" || errorName === "devicesnotfounderror") {
    return [
      "Problema: nenhum microfone disponível foi encontrado.",
      "Como resolver: conecte ou habilite um microfone nas configurações do dispositivo e tente novamente.",
    ].join("\n");
  }
  if (raw.includes("não configurado") || raw.includes("livekit_url")) {
    return [
      "Problema: as credenciais do LiveKit não estão configuradas no servidor.",
      "Como resolver: confira LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET nas configurações do projeto.",
    ].join("\n");
  }
  if (raw.includes("agentdispatch") || raw.includes("enviar o agente")) {
    return [
      "Problema: o agente LiveKit não entrou na sala de teste.",
      `Motivo provável: ${detail}`,
      "Como resolver: confira se o worker Python está rodando e conectado ao mesmo projeto LiveKit.",
    ].join("\n");
  }
  if (raw.includes("401") || raw.includes("unauthorized") || raw.includes("not authorized")) {
    return [
      "Problema: o LiveKit recusou a operação por autorização.",
      `Motivo provável: ${detail}`,
      "Como resolver: confira LIVEKIT_API_KEY, LIVEKIT_API_SECRET e permissões do projeto LiveKit.",
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

function AudioPlaybackGuard() {
  const { canPlayAudio, startAudio } = useAudioPlayback();

  if (canPlayAudio) return null;

  return (
    <Alert className="border-warning/40 bg-warning/10">
      <AlertDescription className="flex flex-col gap-3 text-xs leading-relaxed text-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>O navegador bloqueou a reprodução do áudio da chamada.</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-border bg-card/40"
          onClick={() => void startAudio()}
        >
          Ativar áudio
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function LivekitCallDialog({ agentId, agentName, open, onOpenChange }: Props) {
  const startCallFn = useServerFn(startLivekitCall);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [session, setSession] = useState<LivekitCallSession | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [muted, setMuted] = useState(false);
  const [costAck, setCostAck] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [agentJoined, setAgentJoined] = useState(false);
  const [agentAudioReady, setAgentAudioReady] = useState(false);
  const [agentWaitNotice, setAgentWaitNotice] = useState<string | null>(null);
  // Token usado de fato na sala (evita reconectar durante rerenders).
  const sessionRef = useRef<LivekitCallSession | null>(null);
  const roomRef = useRef<Room | null>(null);

  const sessionMutation = useMutation({
    mutationFn: () => startCallFn({ data: { agentId } }),
  });

  const disconnectRoom = useCallback(() => {
    const currentRoom = roomRef.current;
    roomRef.current = null;
    if (currentRoom) {
      void currentRoom.disconnect();
    }
    setRoom(null);
  }, []);

  // Reset completo ao fechar.
  useEffect(() => {
    if (!open) {
      sessionRef.current = null;
      disconnectRoom();
      setSession(null);
      setStatus("idle");
      setErrorMsg(null);
      setMuted(false);
      setCostAck(false);
      setElapsed(0);
      setAgentJoined(false);
      setAgentAudioReady(false);
      setAgentWaitNotice(null);
    }
  }, [open, disconnectRoom]);

  // Cronômetro da chamada.
  useEffect(() => {
    if (status !== "in_call") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Observa se o worker entrou na sala e publicou áudio remoto.
  useEffect(() => {
    if (!room) return;

    const updateAgentState = () => {
      const participants = Array.from(room.remoteParticipants.values());
      const hasParticipant = participants.length > 0;
      const hasAudio = participants.some((participant) =>
        Array.from(participant.trackPublications.values()).some(
          (publication) => publication.kind === Track.Kind.Audio && publication.isSubscribed,
        ),
      );

      setAgentJoined(hasParticipant);
      setAgentAudioReady(hasAudio);
      if (hasAudio) setAgentWaitNotice(null);
    };

    updateAgentState();
    room.on(RoomEvent.ParticipantConnected, updateAgentState);
    room.on(RoomEvent.ParticipantDisconnected, updateAgentState);
    room.on(RoomEvent.TrackPublished, updateAgentState);
    room.on(RoomEvent.TrackSubscribed, updateAgentState);
    room.on(RoomEvent.TrackUnsubscribed, updateAgentState);
    room.on(RoomEvent.TrackUnpublished, updateAgentState);

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateAgentState);
      room.off(RoomEvent.ParticipantDisconnected, updateAgentState);
      room.off(RoomEvent.TrackPublished, updateAgentState);
      room.off(RoomEvent.TrackSubscribed, updateAgentState);
      room.off(RoomEvent.TrackUnsubscribed, updateAgentState);
      room.off(RoomEvent.TrackUnpublished, updateAgentState);
    };
  }, [room]);

  // Se a sala conectou, mas o agente/áudio não apareceu, mostra onde travou.
  useEffect(() => {
    if (status !== "in_call" || agentAudioReady) {
      setAgentWaitNotice(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const currentRoom = roomRef.current;
      const hasParticipant = currentRoom
        ? Array.from(currentRoom.remoteParticipants.values()).length > 0
        : agentJoined;

      setAgentWaitNotice(
        hasParticipant
          ? "O agente entrou na sala, mas ainda não publicou áudio. Verifique no terminal do worker os provedores de voz, transcrição e IA."
          : "O navegador entrou na sala, mas o worker do agente ainda não entrou. Verifique se o worker Python está rodando no mesmo projeto LiveKit.",
      );
    }, agentJoined ? 12000 : 8000);

    return () => window.clearTimeout(timeout);
  }, [agentAudioReady, agentJoined, status]);

  async function startCall() {
    setStatus("connecting");
    setErrorMsg(null);
    setElapsed(0);
    setAgentJoined(false);
    setAgentAudioReady(false);
    setAgentWaitNotice(null);
    disconnectRoom();

    const nextRoom = new Room();
    roomRef.current = nextRoom;
    setRoom(nextRoom);

    // Precisa acontecer dentro do clique do usuário; evita autoplay bloquear
    // a saudação inicial do agente quando o track remoto chegar.
    void nextRoom.startAudio().catch(() => {
      /* o aviso de ativar áudio aparece se o navegador ainda bloquear */
    });

    // 1. Permissão de microfone primeiro — falha rápido e clara.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const msg = formatLivekitError(e);
      disconnectRoom();
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      return;
    }

    // 2. Pede ao servidor a sala, o dispatch explícito do agente e o token do navegador.
    try {
      const res = await sessionMutation.mutateAsync();
      sessionRef.current = res;
      setSession(res);
    } catch (e) {
      const msg = formatLivekitError(e);
      disconnectRoom();
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
    }
  }

  function endCall() {
    sessionRef.current = null;
    disconnectRoom();
    setSession(null);
    setAgentJoined(false);
    setAgentAudioReady(false);
    setAgentWaitNotice(null);
    setStatus("ended");
  }

  const handleConnected = useCallback(() => {
    setStatus("in_call");
  }, []);

  const handleDisconnected = useCallback(() => {
    sessionRef.current = null;
    roomRef.current = null;
    setRoom(null);
    setSession(null);
    setAgentJoined(false);
    setAgentAudioReady(false);
    setAgentWaitNotice(null);
    setStatus((s) => (s === "error" ? s : "ended"));
  }, []);

  const handleRoomError = useCallback((e: Error) => {
    const msg = formatLivekitError(e);
    disconnectRoom();
    setStatus("error");
    setErrorMsg(msg);
    toast.error("Erro na chamada", { description: msg.split("\n")[0] });
  }, [disconnectRoom]);

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
                {status === "in_call" && !agentJoined && "Em ligação · aguardando agente"}
                {status === "in_call" && agentJoined && !agentAudioReady && "Em ligação · aguardando áudio"}
                {status === "in_call" && agentAudioReady && "Em ligação"}
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

          {status === "in_call" && agentWaitNotice && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertDescription className="text-xs leading-relaxed text-foreground">
                {agentWaitNotice}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-end gap-2">
            {/* Sala LiveKit: montada apenas quando há token. RoomAudioRenderer
                é obrigatório para o áudio do agente tocar no navegador. */}
            {session && room ? (
              <LiveKitRoom
                room={room}
                token={session.token}
                serverUrl={session.serverUrl}
                connect={true}
                audio={true}
                video={false}
                onConnected={handleConnected}
                onDisconnected={handleDisconnected}
                onError={handleRoomError}
              >
                <AudioPlaybackGuard />
                <RoomAudioRenderer />
                <SessionControls muted={muted} onMutedChange={setMuted} onEnd={endCall} />
              </LiveKitRoom>
            ) : isActive ? (
              <Button variant="destructive" size="sm" disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
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
      </DialogContent>
    </Dialog>
  );
}
