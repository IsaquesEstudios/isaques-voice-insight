import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type Vapi from "@vapi-ai/web";
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
import { getVapiPublicKey } from "@/lib/vapi.functions";

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

type VapiConstructor = new (publicKey: string) => Vapi;

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
      "Problema: o SDK de chamadas da Vapi não carregou corretamente no navegador.",
      "Causa provável: conflito no pacote de eventos usado pelo SDK durante o carregamento do app.",
      "Como resolver: atualize a página e tente novamente; se continuar, é um problema técnico da integração, não da configuração da assistente.",
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

async function loadVapiConstructor(): Promise<VapiConstructor> {
  const mod = await import("@vapi-ai/web");
  const maybeDefault = mod.default as unknown;
  const maybeNestedDefault = (maybeDefault as { default?: unknown } | null)?.default;
  const ctor =
    typeof maybeDefault === "function"
      ? maybeDefault
      : typeof maybeNestedDefault === "function"
        ? maybeNestedDefault
        : null;

  if (!ctor) {
    console.error("[vapi] invalid SDK module shape", mod);
    throw new Error("Não foi possível carregar o SDK de chamadas da Vapi.");
  }

  return ctor as VapiConstructor;
}

export function WebCallDialog({ assistantId, assistantName, open, onOpenChange }: Props) {
  const getKeyFn = useServerFn(getVapiPublicKey);
  const keyQuery = useQuery({
    queryKey: ["vapi-public-key"],
    queryFn: () => getKeyFn(),
    staleTime: Infinity,
    enabled: open,
  });

  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState<"user" | "assistant" | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {
          /* noop */
        }
        vapiRef.current = null;
      }
      setStatus("idle");
      setErrorMsg(null);
      setMuted(false);
      setSpeaker(null);
      setTranscript([]);
    }
  }, [open]);

  async function startCall() {
    if (!keyQuery.data?.publicKey) return;
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

    // Sanity check: public keys are UUIDs; private keys start with "sk_"
    if (keyQuery.data.publicKey.startsWith("sk_")) {
      setStatus("error");
      setErrorMsg(
        "A secret VAPI_PUBLIC_KEY parece ser uma chave privada (sk_...). Use a Public Key da Vapi (Dashboard → API Keys → Public Key).",
      );
      return;
    }

    // Timeout — surface a helpful message if Vapi never fires call-start/error
    const timeout = window.setTimeout(() => {
      setErrorMsg((prev) =>
        prev ??
        "A chamada demorou demais para conectar. Verifique se a Public Key da Vapi corresponde à conta que criou este assistente, e se o assistente tem transcriber + voice + model configurados.",
      );
      setStatus((s) => (s === "connecting" ? "error" : s));
    }, 15000);

    try {
      const VapiCtor = await loadVapiConstructor();
      const vapi = new VapiCtor(keyQuery.data.publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        console.log("[vapi] call-start");
        setStatus("in_call");
      });
      vapi.on("call-end", () => {
        console.log("[vapi] call-end");
        setStatus("ended");
      });
      vapi.on("call-start-progress", (event) => {
        console.log("[vapi] call-start-progress", event);
      });
      vapi.on("call-start-failed", (event) => {
        console.error("[vapi] call-start-failed", event);
        const msg = formatCallError(event?.error || event || "Falha ao iniciar chamada.");
        setStatus("error");
        setErrorMsg(msg);
        showCallError(msg);
      });
      vapi.on("speech-start", () => setSpeaker("assistant"));
      vapi.on("speech-end", () => setSpeaker(null));
      vapi.on("error", (e: unknown) => {
        console.error("[vapi] error event", e);
        const msg = formatCallError(e);
        setStatus("error");
        setErrorMsg(msg);
        showCallError(msg);
      });
      vapi.on("message", (message: {
        type?: string;
        transcriptType?: string;
        role?: string;
        transcript?: string;
      }) => {
        console.log("[vapi] message", message);
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

      console.log("[vapi] starting call for assistant", assistantId);
      const res = await vapi.start(assistantId);
      console.log("[vapi] start resolved", res);
      window.clearTimeout(timeout);
    } catch (e) {
      window.clearTimeout(timeout);
      console.error("[vapi] start threw", e);
      const msg = formatCallError(e);
      setStatus("error");
      setErrorMsg(msg);
      showCallError(msg);
    }
  }


  function endCall() {
    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch {
        /* noop */
      }
    }
    setStatus("ended");
  }

  function toggleMute() {
    if (!vapiRef.current) return;
    const next = !muted;
    vapiRef.current.setMuted(next);
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
          {keyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : keyQuery.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível obter a chave pública da Vapi. Verifique a secret
                VAPI_PUBLIC_KEY.
              </AlertDescription>
            </Alert>
          ) : (
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
                disabled={!keyQuery.data?.publicKey || keyQuery.isLoading}
                className="gap-2"
              >
                <PhoneCall className="h-4 w-4" />
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
