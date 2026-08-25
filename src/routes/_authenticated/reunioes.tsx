import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Video, Sparkles, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  LivekitMeetingRoom,
  type MeetingSession,
} from "@/components/reunioes/livekit-meeting-room";
import { joinLivekitMeeting, startLivekitMeeting } from "@/lib/livekit.functions";
import { translateError } from "@/lib/error-messages";

export const Route = createFileRoute("/_authenticated/reunioes")({
  head: () => ({
    meta: [
      { title: "Reunião em vídeo" },
      { name: "description", content: "Crie e entre em salas de reunião em vídeo." },
    ],
  }),
  component: ReunioesPage,
});

function ReunioesPage() {
  const [displayName, setDisplayName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [session, setSession] = useState<MeetingSession | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const startMeeting = useServerFn(startLivekitMeeting);
  const joinMeeting = useServerFn(joinLivekitMeeting);

  const handleCreate = async () => {
    if (!roomInput.trim()) {
      toast.error("Dê um nome para a reunião");
      return;
    }
    setBusy("create");
    try {
      const s = await startMeeting({
        data: {
          meetingName: roomInput.trim(),
          displayName: displayName.trim() || undefined,
        },
      });
      setSession(s);
    } catch (e) {
      toast.error(translateError(e, "Não foi possível criar a reunião."));
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    if (!joinInput.trim()) {
      toast.error("Informe o código da reunião");
      return;
    }
    setBusy("join");
    try {
      const s = await joinMeeting({
        data: {
          code: joinInput.trim(),
          displayName: displayName.trim() || undefined,
        },
      });
      setSession(s);
    } catch (e) {
      toast.error(translateError(e, "Não foi possível entrar na reunião."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reunião em vídeo</h1>
              <p className="text-sm text-muted-foreground">
                Crie salas instantâneas ou entre em uma existente. Áudio e vídeo direto no navegador.
              </p>
            </div>
          </div>
        </header>

        {!session ? (
          <div className="grid min-h-[55vh] place-items-center">
            <Card className="w-full max-w-md border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Criar reunião
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">Nome da reunião</Label>
                  <Input
                    id="roomName"
                    placeholder="ex: reuniao comercial"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Seu nome (opcional)</Label>
                  <Input
                    id="displayName"
                    placeholder="Como você quer aparecer"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  size="lg"
                  className="w-full gap-2"
                  disabled={busy !== null}
                >
                  {busy === "create" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  Criar reunião
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Depois de criar, você recebe um código e um link para enviar aos convidados.
                </p>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="joinCode">Entrar com código</Label>
                  <div className="flex gap-2">
                    <Input
                      id="joinCode"
                      placeholder="reuniao-..."
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoin();
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={handleJoin}
                      disabled={busy !== null}
                      className="gap-2"
                    >
                      {busy === "join" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="h-4 w-4" />
                      )}
                      Entrar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <LivekitMeetingRoom session={session} onLeave={() => setSession(null)} />
        )}
      </div>
    </DashboardShell>
  );
}
