import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useParticipants,
} from "@livekit/components-react";
import { ParticipantKind } from "livekit-client";
import "@livekit/components-styles";
import { Bot, Check, Copy, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { callLivekitMeetingAgent } from "@/lib/livekit.functions";
import { translateError } from "@/lib/error-messages";

export interface MeetingSession {
  token: string;
  serverUrl: string;
  roomName: string;
}

type AiState = "idle" | "calling" | "waiting" | "joined";

/** Detecta quando o agente (worker LiveKit) entra na sala. */
function AgentPresence({ onJoined }: { onJoined: () => void }) {
  const participants = useParticipants();
  const present = participants.some((p) => p.kind === ParticipantKind.AGENT);
  if (present) onJoined();
  return null;
}

interface Props {
  session: MeetingSession;
  onLeave: () => void;
}

/**
 * Sala de reunião LiveKit compartilhada entre o painel (usuário logado) e a
 * rota pública de convidados. Inclui grade de vídeo pronta (VideoConference),
 * cópia de código/link e o botão "Chamar IA".
 */
export function LivekitMeetingRoom({ session, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [aiState, setAiState] = useState<AiState>("idle");
  const callAgent = useServerFn(callLivekitMeetingAgent);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.roomName);
      setCopiedCode(true);
      toast.success("Código copiado");
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/reuniao/${session.roomName}`,
      );
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleCallAgent = async () => {
    setAiState("calling");
    try {
      await callAgent({ data: { code: session.roomName } });
      setAiState("waiting");
      toast.success("IA a caminho… ela entra na sala em alguns segundos.");
    } catch (e) {
      setAiState("idle");
      toast.error(translateError(e, "Não foi possível chamar a IA."));
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Código da reunião</p>
          <CardTitle className="truncate font-mono text-base">
            {session.roomName}
          </CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyCode} className="gap-2">
            {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar código
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar link
          </Button>
          {aiState === "joined" ? (
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Check className="h-4 w-4" />
              IA na sala
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCallAgent}
              disabled={aiState === "calling" || aiState === "waiting"}
              className="gap-2"
            >
              {aiState === "calling" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              {aiState === "waiting" ? "IA a caminho…" : "Chamar IA"}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={onLeave} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <LiveKitRoom
          token={session.token}
          serverUrl={session.serverUrl}
          connect
          audio
          video
          data-lk-theme="default"
          className="lk-room-container block h-[70vh] w-full"
          onDisconnected={onLeave}
          onError={(e) =>
            toast.error(translateError(e, "Erro na conexão da reunião."))
          }
        >
          <AgentPresence onJoined={() => setAiState("joined")} />
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </CardContent>
    </Card>
  );
}
