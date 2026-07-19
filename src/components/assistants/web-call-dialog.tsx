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
import { getVapiWebCallToken } from "@/lib/vapi.functions";

// Tipo mínimo do SDK. Importamos dinamicamente no start para evitar quebrar
// SSR/bundle e permitir tratamento de erro amigável se o pacote falhar.
type VapiInstance = {
  start: (assistantId: string, assistantOverrides?: Record<string, unknown>) => Promise<unknown>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeAllListeners?: () => void;
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
      "Problema: o SDK da Vapi não carregou corretamente no navegador.",
      "Como resolver: recarregue a página (Ctrl+Shift+R) e tente novamente.",
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
  const getTokenFn = useServerFn(getVapiWebCallToken);

  const vapiRef = useRef<VapiInstance | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState<"user" | "assistant" | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const tokenMutation = useMutation({
    mutationFn: () => getTokenFn({ data: { assistantId } }),
  });

  const teardown = () => {
    const v = vapiRef.current;
    vapiRef.current = null;
    if (v) {
      try {
        v.stop();
      } catch {
        /* noop */
      }
      try {
        v.removeAllListeners?.();
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

    // 2. Busca a Public Key da Vapi no servidor.
    let publicKey: string;
    try {
      const res = await tokenMutation.mutateAsync();
      publicKey = res.publicKey;
    } catch (e) {
      const msg = formatCallError(e);
      setStatus("error");
      setErrorMsg(msg);
      toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      return;
    }

    // 3. Carrega e inicia o SDK oficial da Vapi.
    try {
      const mod = await import("@vapi-ai/web");
      const Vapi = (mod as { default: new (key: string) => VapiInstance }).default;
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setStatus("in_call");
      });
      vapi.on("call-end", () => {
        setStatus("ended");
      });
      vapi.on("speech-start", () => setSpeaker("assistant"));
      vapi.on("speech-end", () => setSpeaker(null));
      vapi.on("volume-level", () => {
        /* placeholder — poderíamos animar volume aqui */
      });
      vapi.on("message", (raw) => {
        const message = raw as {
          type?: string;
          role?: string;
          transcript?: string;
          transcriptType?: string;
        };
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
      });
      vapi.on("error", (e) => {
        console.error("[vapi-web] error", e);
        const msg = formatCallError(e);
        setStatus("error");
        setErrorMsg(msg);
        toast.error("Erro na chamada", { description: msg.split("\n")[0] });
      });

      await vapi.start(assistantId);
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
    const v = vapiRef.current;
    if (!v) return;
    const next = !muted;
    v.setMuted(next);
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
                disabled={tokenMutation.isPending || status === "connecting"}
                className="gap-2"
              >
                {tokenMutation.isPending || status === "connecting" ? (
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
