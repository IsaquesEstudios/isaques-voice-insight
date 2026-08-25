import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, UserX, Video } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LivekitMeetingRoom,
  MeetingEndedScreen,
  type MeetingSession,
} from "@/components/reunioes/livekit-meeting-room";
import {
  getMeetingJoinRequestStatus,
  requestMeetingJoin,
} from "@/lib/livekit.functions";
import { translateError } from "@/lib/error-messages";

export const Route = createFileRoute("/reuniao/$code")({
  head: () => ({
    meta: [
      { title: "Reunião Omniasyn" },
      {
        name: "description",
        content: "Entre na reunião em vídeo Omniasyn como convidado.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Reunião Omniasyn" },
      {
        property: "og:description",
        content: "Entre na reunião em vídeo Omniasyn como convidado.",
      },
    ],
  }),
  component: GuestMeetingPage,
});

function GuestMeetingPage() {
  const { code } = Route.useParams();
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<MeetingSession | null>(null);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [waiting, setWaiting] = useState<{
    requestId: string;
    meetingName: string;
  } | null>(null);
  const requestJoin = useServerFn(requestMeetingJoin);
  const checkStatus = useServerFn(getMeetingJoinRequestStatus);
  const waitingRequestId = waiting?.requestId ?? null;

  // Sala de espera: consulta o pedido até o organizador aprovar/recusar.
  useEffect(() => {
    if (!waitingRequestId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await checkStatus({ data: { requestId: waitingRequestId } });
        if (cancelled) return;
        if (res.status === "approved" && res.session) {
          setSession(res.session);
          setWaiting(null);
        } else if (res.status === "denied") {
          setDenied(true);
          setWaiting(null);
        } else if (res.status === "expired") {
          setError("Seu pedido de entrada expirou. Envie novamente.");
          setWaiting(null);
        }
      } catch {
        /* falha de rede — tenta no próximo ciclo */
      }
    };
    void poll();
    const id = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingRequestId]);

  const handleJoin = async () => {
    if (!displayName.trim()) {
      setError("Informe seu nome para entrar na reunião.");
      return;
    }
    setBusy(true);
    setError(null);
    setDenied(false);
    try {
      const r = await requestJoin({
        data: { code, displayName: displayName.trim() },
      });
      setWaiting({ requestId: r.requestId, meetingName: r.meetingName });
    } catch (e) {
      setError(translateError(e, "Não foi possível entrar na reunião."));
      toast.error("Não foi possível entrar na reunião.");
    } finally {
      setBusy(false);
    }
  };

  if (session && ended) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md">
          <MeetingEndedScreen
            actionLabel="Voltar"
            onAction={() => {
              setSession(null);
              setEnded(false);
            }}
          />
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex min-h-screen flex-col bg-background p-4 sm:p-6">
        <LivekitMeetingRoom
          session={session}
          onLeave={() => setSession(null)}
          onEnded={() => setEnded(true)}
        />
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="w-full max-w-md border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-center">
          <CardHeader>
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <CardTitle className="text-lg">Aguardando aprovação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O organizador de{" "}
              <span className="font-medium text-foreground">{waiting.meetingName}</span>{" "}
              foi avisado e vai liberar sua entrada em instantes.
            </p>
            <p className="text-xs text-muted-foreground">
              Não feche esta página — você entra automaticamente quando for aprovado.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setWaiting(null)}>
              Cancelar e voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="w-full max-w-md border-destructive/40 text-center">
          <CardHeader>
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <UserX className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Entrada não autorizada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O organizador recusou sua entrada nesta reunião. Se acredita que
              isso foi um engano, fale com quem enviou o convite.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDenied(false)}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
            <Video className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">Você foi convidado para uma reunião</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">{code}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível entrar</AlertTitle>
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="guestName">Seu nome</Label>
            <Input
              id="guestName"
              placeholder="Como você quer aparecer na reunião"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>
          <Button
            onClick={handleJoin}
            size="lg"
            className="w-full gap-2"
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Video className="h-4 w-4" />
            )}
            Pedir para entrar
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            O organizador vai aprovar sua entrada. Áudio e vídeo direto no
            navegador — nenhuma instalação necessária.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
