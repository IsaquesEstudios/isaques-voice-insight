import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

type BrowserCallInstance = {
  stop: () => void | Promise<void>;
  setMuted: (muted: boolean) => void;
};

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
  if (!error) return "Erro desconhecido.";
  if (typeof error === "string") return error;
  const err = error as {
    error?: { message?: string; msg?: string } | string;
    message?: string;
    errorMsg?: string;
    action?: string;
  };
  if (typeof err.error === "string") return err.error;
  const m =
    err?.error?.message || err?.error?.msg || err?.errorMsg || err?.message || err?.action;
  if (m) return m;
  try {
    return JSON.stringify(error);
  } catch {
    return "Erro desconhecido.";
  }
}

function formatCallError(error: unknown): string {
  const detail = extractErrorMessage(error);
  const n = detail.toLowerCase();

  if (n.includes("class extends value") || n.includes("is not a constructor")) {
    return [
      "Problema: o SDK antigo da Vapi ainda foi carregado pelo navegador.",
      "Como resolver: recarregue a página publicada sem cache e teste novamente.",
      `Detalhe técnico: ${detail}`,
    ].join("\n");
  }
  if (
    n.includes("permission") ||
    n.includes("microphone") ||
    n.includes("notallowederror") ||
    n.includes("permission denied")
  ) {
    return [
      "Problema: o navegador bloqueou o microfone.",
      "Como resolver: clique no cadeado da barra de endereço, libere o microfone e tente de novo.",
      `Detalhe técnico: ${detail}`,
    ].join("\n");
  }
  if (n.includes("assistant-did-not-receive-customer-audio")) {
    return [
      "Problema: a Vapi não recebeu áudio do seu microfone durante a ligação.",
      "Como resolver: verifique se o microfone correto está selecionado no sistema, que não está mudo, e tente novamente.",
      `Detalhe técnico: ${detail}`,
    ].join("\n");
  }
  if (
    n.includes("unauthorized") ||
    n.includes("invalid key") ||
    n.includes("public key") ||
    n.includes("api key")
  ) {
    return [
      "Problema: a Public Key da Vapi está ausente ou pertence a outra conta.",
      "Como resolver: vá em Configurações → API & Chaves e atualize a Public Key da mesma conta onde a assistente foi criada.",
      `Detalhe técnico: ${detail}`,
    ].join("\n");
  }
  if (
    n.includes("couldn't get assistant") ||
    n.includes("couldn’t get assistant") ||
    n.includes("does not exist") ||
    n.includes("not found") ||
    n.includes("404")
  ) {
    return [
      "Problema: a assistente não foi encontrada pela Public Key configurada.",
      "Como resolver: confirme se a Public Key e a assistente pertencem à mesma organização Vapi.",
      `Detalhe técnico: ${detail}`,
    ].join("\n");
  }
  return [
    "Problema: a ligação de teste não pôde ser iniciada.",
    "Como resolver: confira modelo, voz e transcriber da assistente e tente novamente.",
    `Detalhe técnico: ${detail}`,
  ].join("\n");
}

export function WebCallDialog({ assistantId, assistantName, open, onOpenChange }: Props) {
  const createWebCallFn = useServerFn(createVapiWebCall);

  const callRef = useRef<BrowserCallInstance | null>(null);
  const audioElsRef = useRef<HTMLAudioElement[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState<"user" | "assistant" | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const webCallMutation = useMutation({
    mutationFn: () => createWebCallFn({ data: { assistantId } }),
  });

  const teardown = () => {
    const activeCall = callRef.current;
    callRef.current = null;
    audioElsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* noop */
      }
    });
    audioElsRef.current = [];
    if (activeCall) {
      try {
        void activeCall.stop();
      } catch {
        /* noop */
      }
    }
  };

  useEffect(() => {
    if (!open) {
      teardown();
      setStatus("idle");
      setErrorMsg(null);
      setMuted(false);
      setSpeaker(null);
      setTranscript([]);
    }
  }, [open]);

  useEffect(() => () => teardown(), []);

  async function startCall() {
    setStatus("connecting");
    setErrorMsg(null);
    setTranscript([]);
    teardown();

    // 1. Solicita microfone antes de tudo — falha rápido e clara.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Libera o stream imediatamente; o SDK vai pedir novamente ao iniciar
      // a ligação, mas isso garante que a permissão já está concedida.
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const msg = formatCallError(e);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      return;
    }

    // 2. Cria a chamada web real na Vapi via servidor e recebe a sala oficial.
    let webCallUrl: string;
    try {
      const res = await webCallMutation.mutateAsync();
      webCallUrl = res.webCallUrl;
    } catch (e) {
      const msg = formatCallError(e);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      return;
    }

    // 3. Entra na sala Daily retornada pela Vapi, sem carregar o SDK problemático.
    try {
      const dailyMod: any = await import("@daily-co/daily-js");
      const DailyIframe = dailyMod.default ?? dailyMod;
      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      });

      const handleMessage = (raw: unknown) => {
        const message = raw as {
          type?: string;
          status?: string;
          role?: string;
          transcript?: string;
          transcriptType?: string;
          endedReason?: string;
        };
        if (message?.type === "status-update" && message.status === "ended") {
          setStatus("ended");
          setSpeaker(null);
          return;
        }
        if (
          message?.type === "transcript" &&
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
      };

      const subscribeToParticipant = (participant: any) => {
        if (!participant || participant.local || !participant.session_id) return;
        try {
          call.updateParticipant(participant.session_id, {
            setSubscribedTracks: { audio: true, video: false },
          });
        } catch {
          /* noop */
        }
      };

      callRef.current = {
        stop: () => call.destroy(),
        setMuted: (nextMuted: boolean) => call.setLocalAudio(!nextMuted),
      };

      call.on("joined-meeting", () => {
        setStatus("in_call");
        try {
          const participants = call.participants?.() ?? {};
          Object.values(participants).forEach(subscribeToParticipant);
        } catch {
          /* noop */
        }
      });
      call.on("left-meeting", () => {
        setStatus("ended");
        setSpeaker(null);
      });
      call.on("participant-joined", (event: any) => subscribeToParticipant(event?.participant));
      call.on("track-started", async (event: any) => {
        const participant = event?.participant;
        const track = event?.track as MediaStreamTrack | undefined;
        if (!participant || participant.local || !track || track.kind !== "audio") return;
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.muted = false;
        audio.playsInline = true;
        audio.dataset.participantId = participant.session_id ?? "vapi";
        audio.srcObject = new MediaStream([track]);
        document.body.appendChild(audio);
        audioElsRef.current.push(audio);
        try {
          await audio.play();
        } catch (playError) {
          console.warn("[vapi-web] autoplay blocked", playError);
        }
        try {
          call.sendAppMessage("playable");
        } catch {
          /* noop */
        }
      });
      call.on("participant-left", (event: any) => {
        const sessionId = event?.participant?.session_id;
        if (!sessionId) return;
        audioElsRef.current = audioElsRef.current.filter((audio) => {
          if (audio.dataset.participantId !== sessionId) return true;
          audio.remove();
          return false;
        });
      });
      call.on("remote-participants-audio-level", (event: any) => {
        const levels = Object.values(event?.participantsAudioLevel ?? {}) as number[];
        const speaking = levels.some((level) => level > 0.01);
        if (speaking) {
          setSpeaker("assistant");
          window.setTimeout(() => setSpeaker((s) => (s === "assistant" ? null : s)), 1000);
        }
      });
      call.on("app-message", (event: any) => {
        if (event?.data === "listening") {
          setStatus("in_call");
          return;
        }
        try {
          handleMessage(typeof event?.data === "string" ? JSON.parse(event.data) : event?.data);
        } catch (parseError) {
          console.warn("[vapi-web] app-message parse failed", parseError);
        }
      });
      call.on("error", (e: unknown) => {
        console.error("[vapi-web] daily error", e);
        const msg = formatCallError(e);
        setStatus("error");
        setErrorMsg(msg);
        toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      });

      await call.join({ url: webCallUrl, subscribeToTracksAutomatically: false });
      try {
        call.startRemoteParticipantsAudioLevelObserver?.(100);
        call.startLocalAudioLevelObserver?.(100);
      } catch {
        /* noop */
      }
      try {
        call.updateInputSettings?.({
          audio: { processor: { type: "noise-cancellation" } },
        });
      } catch {
        /* noop */
      }
    } catch (e) {
      console.error("[vapi-web] start threw", e);
      teardown();
      const msg = formatCallError(e);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
    }
  }

  function endCall() {
    teardown();
    setStatus("ended");
  }

  function toggleMute() {
    const activeCall = callRef.current;
    if (!activeCall) return;
    const next = !muted;
    activeCall.setMuted(next);
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
        </div>

        <DialogFooter className="gap-2">
          {!isActive ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                onClick={startCall}
                disabled={webCallMutation.isPending}
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
