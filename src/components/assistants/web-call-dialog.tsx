import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectAppMessage,
  type DailyEventObjectRemoteParticipantsAudioLevel,
  type DailyEventObjectTrack,
} from "@daily-co/daily-js";
import { Loader2, Mic, MicOff, PhoneOff, PhoneCall, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createVapiWebCall } from "@/lib/vapi.functions";

type Status = "idle" | "connecting" | "in_call" | "ended" | "error";

interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface Props {
  assistantId: string;
  assistantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;

  const err = error as {
    error?: { message?: string; msg?: string } | string;
    message?: string;
    errorMsg?: string;
  };

  if (typeof err?.error === "string") return err.error;

  const message = err?.error?.message || err?.error?.msg || err?.errorMsg || err?.message;
  if (message) return message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Erro desconhecido.";
  }
}

function formatCallError(error: unknown): string {
  const technicalDetail = extractErrorMessage(error);
  const normalized = technicalDetail.toLowerCase();

  if (normalized.includes("class extends value") || normalized.includes("is not a constructor")) {
    return [
      "Problema: a biblioteca de áudio da chamada não carregou corretamente no navegador.",
      "Causa provável: conflito temporário no carregamento dos pacotes da página.",
      "Como resolver: atualize a página e tente novamente; a chamada agora não depende mais do SDK antigo da Vapi.",
      `Detalhe técnico: ${technicalDetail}`,
    ].join("\n");
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("microphone") ||
    normalized.includes("notallowederror") ||
    normalized.includes("permission denied")
  ) {
    return [
      "Problema: o navegador bloqueou o acesso ao microfone.",
      "Causa provável: a permissão de microfone foi negada ou ainda não foi concedida para este site.",
      "Como resolver: libere o microfone no navegador e inicie a ligação novamente.",
      `Detalhe técnico: ${technicalDetail}`,
    ].join("\n");
  }

  if (
    normalized.includes("public key") ||
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid key")
  ) {
    return [
      "Problema: a chave pública da Vapi está ausente, incorreta ou pertence a outra conta.",
      "Causa provável: VAPI_PUBLIC_KEY não é a Public Key da mesma conta onde essa assistente foi criada.",
      "Como resolver: confira a secret VAPI_PUBLIC_KEY e nunca use a Private Key nesse campo.",
      `Detalhe técnico: ${technicalDetail}`,
    ].join("\n");
  }

  if (normalized.includes("assistant") && (normalized.includes("not found") || normalized.includes("404"))) {
    return [
      "Problema: a assistente não foi encontrada na conta Vapi usada pela chave pública.",
      "Causa provável: o ID da assistente pertence a outra conta ou ela foi removida.",
      "Como resolver: confirme se a assistente e a VAPI_PUBLIC_KEY são da mesma conta Vapi.",
      `Detalhe técnico: ${technicalDetail}`,
    ].join("\n");
  }

  return [
    "Problema: a ligação de teste não pôde ser iniciada.",
    "Causa provável: alguma configuração obrigatória da assistente falhou ou a Vapi recusou a chamada.",
    "Como resolver: confira se a assistente tem modelo, voz e transcrição configurados e tente novamente.",
    `Detalhe técnico: ${technicalDetail}`,
  ].join("\n");
}

function showCallError(message: string) {
  toast.error("Erro na chamada", {
    description: message.split("\n").slice(0, 3).join("\n"),
  });
}

export function WebCallDialog({ assistantId, assistantName, open, onOpenChange }: Props) {
  const createWebCallFn = useServerFn(createVapiWebCall);

  const callRef = useRef<DailyCall | null>(null);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState<"user" | "assistant" | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const webCallMutation = useMutation({
    mutationFn: () => createWebCallFn({ data: { assistantId } }),
  });

  const cleanupCall = async () => {
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    const currentCall = callRef.current;
    callRef.current = null;
    if (currentCall && !currentCall.isDestroyed()) {
      await currentCall.destroy().catch(() => undefined);
    }
  };

  const handleAppMessage = (event?: DailyEventObjectAppMessage<string>) => {
    if (!event?.data) return;
    if (event.data === "listening") {
      setStatus("in_call");
      return;
    }

    try {
      const message = JSON.parse(event.data) as {
        type?: string;
        transcriptType?: string;
        role?: string;
        transcript?: string;
        status?: string;
      };
      console.log("[vapi-web] message", message);
      if (message.type === "status-update" && message.status === "ended") {
        setStatus("ended");
      }
      if (
        message.type === "transcript" &&
        message.transcriptType === "final" &&
        message.transcript &&
        (message.role === "user" || message.role === "assistant")
      ) {
        setTranscript((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            role: message.role as "user" | "assistant",
            text: message.transcript!,
          },
        ]);
      }
    } catch (parseError) {
      console.log("[vapi-web] app-message parse error", parseError);
    }
  };

  const handleRemoteAudioLevel = (event: DailyEventObjectRemoteParticipantsAudioLevel) => {
    const speechLevel = Object.values(event.participantsAudioLevel).reduce(
      (total, level) => total + level,
      0,
    );
    const isSpeaking = speechLevel > 0.01;
    if (!isSpeaking) return;

    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    } else {
      setSpeaker("assistant");
    }

    speakingTimeoutRef.current = setTimeout(() => {
      setSpeaker(null);
      speakingTimeoutRef.current = null;
    }, 1000);
  };

  const handleTrackStarted = (event?: DailyEventObjectTrack) => {
    if (!event?.participant?.local && event?.track?.kind === "audio") {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.style.display = "none";
      audio.srcObject = new MediaStream([event.track]);
      audio.play().catch((playError) => {
        console.warn("[vapi-web] autoplay blocked", playError);
      });
      document.body.appendChild(audio);
      event.track.addEventListener("ended", () => audio.remove(), { once: true });
    }
  };

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      void cleanupCall();
      setStatus("idle");
      setErrorMsg(null);
      setMuted(false);
      setSpeaker(null);
      setTranscript([]);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      void cleanupCall();
    };
  }, []);

  async function startCall() {
    setStatus("connecting");
    setErrorMsg(null);
    setTranscript([]);

    try {
      // Permission ping — clearer error than Vapi's generic failure
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setStatus("error");
      const msg = formatCallError(e);
      setErrorMsg(msg);
      showCallError(msg);
      return;
    }

    // Timeout — surface a helpful message if Vapi never fires call-start/error
    const timeout = window.setTimeout(() => {
      setErrorMsg((prev) =>
        prev ??
        "A chamada demorou demais para conectar. Verifique se o assistente tem transcriber + voice + model configurados e tente novamente.",
      );
      setStatus((s) => (s === "connecting" ? "error" : s));
    }, 15000);

    try {
      await cleanupCall();
      const webCall = await webCallMutation.mutateAsync();
      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
        subscribeToTracksAutomatically: true,
      });
      callRef.current = call;

      call.on("app-message", handleAppMessage);
      call.on("remote-participants-audio-level", handleRemoteAudioLevel);
      call.on("track-started", handleTrackStarted);
      call.on("left-meeting", () => setStatus("ended"));
      call.on("error", (e: unknown) => {
        console.error("[vapi-web] daily error", e);
        const msg = formatCallError(e);
        setStatus("error");
        setErrorMsg(msg);
        showCallError(msg);
      });

      await call.join({ url: webCall.webCallUrl });
      await call.startRemoteParticipantsAudioLevelObserver(100);
      setStatus("in_call");
      window.clearTimeout(timeout);
    } catch (e) {
      window.clearTimeout(timeout);
      console.error("[vapi-web] start threw", e);
      await cleanupCall();
      const msg = formatCallError(e);
      setStatus("error");
      setErrorMsg(msg);
      showCallError(msg);
    }
  }


  function endCall() {
    if (callRef.current && !callRef.current.isDestroyed()) {
      callRef.current.sendAppMessage(JSON.stringify({ type: "end-call" }));
    }
    void cleanupCall();
    setStatus("ended");
  }

  function toggleMute() {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.setLocalAudio(!next);
    setMuted(next);
  }

  const isActive = status === "connecting" || status === "in_call";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-card/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Testar no navegador
          </DialogTitle>
          <DialogDescription>
            Fale diretamente com <span className="font-semibold">{assistantName}</span> usando
            o microfone do navegador. Nenhum número de telefone necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {webCallMutation.isError && status === "idle" ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line text-xs leading-relaxed">
                {formatCallError(webCallMutation.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <>
              {/* Status badge */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      status === "in_call" && "animate-pulse bg-success",
                      status === "connecting" && "animate-pulse bg-warning",
                      status === "idle" && "bg-muted",
                      status === "ended" && "bg-muted",
                      status === "error" && "bg-destructive",
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      {status === "idle" && "Pronto para iniciar"}
                      {status === "connecting" && "Conectando..."}
                      {status === "in_call" && "Em ligação"}
                      {status === "ended" && "Chamada encerrada"}
                      {status === "error" && "Erro na chamada"}
                    </p>
                    {status === "in_call" && speaker && (
                      <p className="text-[11px] text-muted-foreground">
                        {speaker === "assistant" ? "IA falando..." : "Você falando..."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-line text-xs leading-relaxed">
                    {errorMsg}
                  </AlertDescription>
                </Alert>
              )}

              {/* Transcript */}
              {(status === "in_call" || status === "ended") && (
                <ScrollArea className="h-56 rounded-xl border border-white/[0.06] bg-background/40 p-3">
                  {transcript.length === 0 ? (
                    <p className="pt-6 text-center text-xs text-muted-foreground">
                      Aguardando fala...
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {transcript.map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            "rounded-lg px-3 py-2 text-xs",
                            t.role === "user"
                              ? "ml-6 bg-primary/15 text-foreground"
                              : "mr-6 bg-white/[0.05] text-foreground",
                          )}
                        >
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t.role === "user" ? "Você" : assistantName}
                          </p>
                          {t.text}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
          </>
        </div>

        <DialogFooter className="gap-2">
          {!isActive ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                onClick={startCall}
                disabled={status === "connecting" || webCallMutation.isPending}
                className="gap-2"
              >
                {webCallMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="h-4 w-4" />
                )}
                {status === "ended" ? "Ligar novamente" : "Iniciar ligação"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={toggleMute} className="gap-2">
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? "Ativar mic" : "Mutar"}
              </Button>
              <Button variant="destructive" onClick={endCall} className="gap-2">
                <PhoneOff className="h-4 w-4" />
                Encerrar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
