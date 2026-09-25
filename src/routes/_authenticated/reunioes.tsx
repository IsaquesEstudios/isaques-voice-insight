import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Captions,
  FileText,
  Link2,
  Loader2,
  LogIn,
  PhoneOff,
  Play,
  Plus,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { DashboardShell } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  LivekitMeetingRoom,
  MeetingEndedScreen,
  type MeetingSession,
} from "@/components/reunioes/livekit-meeting-room";
import {
  closeMeeting,
  enterMeetingAsHost,
  getMeetingTranscript,
  joinLivekitMeeting,
  listMyMeetings,
  startLivekitMeeting,
  type MeetingDTO,
} from "@/lib/livekit.functions";
import { translateError } from "@/lib/error-messages";

export const Route = createFileRoute("/_authenticated/reunioes")({
  head: () => ({
    meta: [
      { title: "Reunião em vídeo" },
      {
        name: "description",
        content: "Crie, agende e acompanhe suas reuniões em vídeo.",
      },
    ],
  }),
  component: ReunioesPage,
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: MeetingDTO["status"] }) {
  if (status === "live") {
    return (
      <Badge className="gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
        Acontecendo agora
      </Badge>
    );
  }
  if (status === "scheduled") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <CalendarClock className="h-3 w-3" />
        Agendada
      </Badge>
    );
  }
  if (status === "ready") {
    return <Badge variant="outline">Pronta para iniciar</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Encerrada
    </Badge>
  );
}

function meetingDateLine(m: MeetingDTO): string {
  if (m.status === "scheduled" && m.scheduledAt)
    return `Agendada para ${fmtDate(m.scheduledAt)}`;
  if (m.status === "ready" && m.scheduledAt)
    return `Estava agendada para ${fmtDate(m.scheduledAt)}`;
  if (m.endedAt) return `Encerrada em ${fmtDate(m.endedAt)}`;
  if (m.startedAt) return `Iniciada em ${fmtDate(m.startedAt)}`;
  return `Criada em ${fmtDate(m.createdAt)}`;
}

function ReunioesPage() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<MeetingSession | null>(null);
  const [ended, setEnded] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [meetingName, setMeetingName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  // Transcrição ligada por padrão: a ata é o principal recurso das reuniões.
  const [transcribe, setTranscribe] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [detailsFor, setDetailsFor] = useState<MeetingDTO | null>(null);

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [enteringCode, setEnteringCode] = useState<string | null>(null);
  const [closingCode, setClosingCode] = useState<string | null>(null);

  const startMeeting = useServerFn(startLivekitMeeting);
  const joinMeeting = useServerFn(joinLivekitMeeting);
  const enterAsHost = useServerFn(enterMeetingAsHost);
  const close = useServerFn(closeMeeting);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["my-meetings"],
    queryFn: () => listMyMeetings(),
    refetchInterval: 15000,
    enabled: !session,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-meetings"] });

  const handleCreate = async () => {
    if (!meetingName.trim()) {
      toast.error("Dê um nome para a reunião");
      return;
    }
    setCreating(true);
    try {
      const result = await startMeeting({
        data: {
          meetingName: meetingName.trim(),
          displayName: displayName.trim() || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          transcribe,
          withAgent: false,
        },
      });
      if (result.kind === "started") {
        setEnded(false);
        setSession({
          token: result.token,
          serverUrl: result.serverUrl,
          roomName: result.roomName,
          transcribe: result.transcribe,
        });
      } else {
        toast.success(`Reunião agendada para ${fmtDate(result.scheduledAt)}.`);
        void refresh();
      }
      setCreateOpen(false);
      setMeetingName("");
      setScheduledAt("");
      setTranscribe(true);
    } catch (e) {
      toast.error(translateError(e, "Não foi possível criar a reunião."));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      toast.error("Informe o código da reunião");
      return;
    }
    setJoining(true);
    try {
      const s = await joinMeeting({
        data: { code: joinCode.trim(), displayName: joinName.trim() || undefined },
      });
      setEnded(false);
      setSession(s);
      setJoinOpen(false);
      setJoinCode("");
    } catch (e) {
      toast.error(translateError(e, "Não foi possível entrar na reunião."));
    } finally {
      setJoining(false);
    }
  };

  const handleEnter = async (code: string) => {
    setEnteringCode(code);
    try {
      const s = await enterAsHost({ data: { code } });
      setEnded(false);
      setSession(s);
    } catch (e) {
      toast.error(translateError(e, "Não foi possível abrir a reunião."));
    } finally {
      setEnteringCode(null);
    }
  };

  const handleCloseMeeting = async (code: string) => {
    setClosingCode(code);
    try {
      await close({ data: { code } });
      toast.success("Reunião encerrada.");
      void refresh();
    } catch (e) {
      toast.error(translateError(e, "Não foi possível encerrar a reunião."));
    } finally {
      setClosingCode(null);
    }
  };

  const handleCopyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/reuniao/${code}`);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 p-6">
        {session && ended ? (
          <MeetingEndedScreen
            actionLabel="Voltar para o início"
            onAction={() => {
              setSession(null);
              setEnded(false);
              void refresh();
            }}
          />
        ) : session ? (
          <LivekitMeetingRoom
            session={session}
            onLeave={() => {
              setSession(null);
              void refresh();
            }}
            onEnded={() => setEnded(true)}
          />
        ) : (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Reunião em vídeo</h1>
                  <p className="text-sm text-muted-foreground">
                    Crie salas instantâneas, agende reuniões e acompanhe o histórico.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setJoinOpen(true)} className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Entrar com código
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova reunião
                </Button>
              </div>
            </header>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !meetings || meetings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Video className="h-6 w-6" />
                  </div>
                  <p className="font-medium">Nenhuma reunião ainda</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Crie sua primeira reunião agora ou agende para depois. Você recebe
                    um código e um link para enviar aos convidados.
                  </p>
                  <Button onClick={() => setCreateOpen(true)} className="mt-2 gap-2">
                    <Plus className="h-4 w-4" />
                    Nova reunião
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => (
                  <Card
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40"
                    onClick={() => setDetailsFor(m)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailsFor(m);
                      }
                    }}
                  >
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{m.name}</p>
                          <StatusBadge status={m.status} />
                          {m.transcribe && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Captions className="h-3 w-3" />
                              Transcrição
                            </Badge>
                          )}
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {m.code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meetingDateLine(m)}
                        </p>
                      </div>
                      <div
                        className="flex shrink-0 flex-wrap gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {(m.status === "live" ||
                          m.status === "ready" ||
                          m.status === "scheduled") && (
                          <>
                            <Button
                              size="sm"
                              className="gap-2"
                              disabled={enteringCode === m.code}
                              onClick={() => void handleEnter(m.code)}
                            >
                              {enteringCode === m.code ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                              {m.status === "live" ? "Entrar" : "Iniciar agora"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => void handleCopyLink(m.code)}
                            >
                              <Link2 className="h-4 w-4" />
                              Copiar link
                            </Button>
                          </>
                        )}
                        {m.status === "live" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={closingCode === m.code}
                            onClick={() => void handleCloseMeeting(m.code)}
                          >
                            {closingCode === m.code ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PhoneOff className="h-4 w-4" />
                            )}
                            Encerrar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova reunião</DialogTitle>
            <DialogDescription>
              Comece agora ou agende um horário. Você recebe um código e um link
              para enviar aos convidados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meetingName">Nome da reunião</Label>
              <Input
                id="meetingName"
                placeholder="ex: reuniao comercial"
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostName">Seu nome (opcional)</Label>
              <Input
                id="hostName"
                placeholder="Como você quer aparecer"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Agendar para (opcional)</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para começar imediatamente.
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-border/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="optTranscribe" className="flex items-center gap-1.5">
                    <Captions className="h-3.5 w-3.5" />
                    Transcrever reunião
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A conversa é transcrita automaticamente e a ata fica salva no
                    histórico da reunião.
                  </p>
                </div>
                <Switch
                  id="optTranscribe"
                  checked={transcribe}
                  onCheckedChange={setTranscribe}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating} className="gap-2">
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              {scheduledAt ? "Agendar reunião" : "Criar e entrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entrar com código</DialogTitle>
            <DialogDescription>
              Cole o código de uma reunião em andamento para participar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="joinCode">Código da reunião</Label>
              <Input
                id="joinCode"
                placeholder="reuniao-..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleJoin();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinName">Seu nome (opcional)</Label>
              <Input
                id="joinName"
                placeholder="Como você quer aparecer"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={joining}>
              Cancelar
            </Button>
            <Button onClick={() => void handleJoin()} disabled={joining} className="gap-2">
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MeetingDetailsDialog
        meeting={detailsFor}
        onClose={() => setDetailsFor(null)}
      />
    </DashboardShell>
  );
}

/** Detalhes da reunião (clique no card): informações + ata transcrita pela IA. */
function MeetingDetailsDialog({
  meeting,
  onClose,
}: {
  meeting: MeetingDTO | null;
  onClose: () => void;
}) {
  const fetchTranscript = useServerFn(getMeetingTranscript);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["meeting-transcript", meeting?.code],
    queryFn: () => fetchTranscript({ data: { code: meeting!.code } }),
    enabled: !!meeting,
  });

  return (
    <Dialog open={!!meeting} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            {meeting?.name}
          </DialogTitle>
          <DialogDescription>Detalhes e ata da reunião.</DialogDescription>
        </DialogHeader>

        {meeting && (
          <div className="space-y-2 rounded-lg border border-border/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={meeting.status} />
              {meeting.transcribe && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Captions className="h-3 w-3" />
                  Transcrição
                </Badge>
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              Código: {meeting.code}
            </p>
            <p className="text-xs text-muted-foreground">
              {meetingDateLine(meeting)}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <FileText className="h-4 w-4 text-primary" />
            Transcrição
          </p>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando transcrição…
            </div>
          ) : isError ? (
            <p className="py-4 text-center text-sm text-destructive">
              Não foi possível carregar a transcrição.
            </p>
          ) : !data ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma transcrição gravada para esta reunião ainda. A ata aparece
              aqui quando o agente de IA finaliza a escuta.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Gravada em {fmtDate(data.criadoEm)} · transcrita automaticamente
                  pela IA (Deepgram).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(data.conteudo);
                      toast.success("Ata copiada para a área de transferência.");
                    } catch {
                      toast.error("Não consegui copiar a ata.");
                    }
                  }}
                >
                  Copiar ata
                </Button>
              </div>
              <ScrollArea className="max-h-[50vh] rounded-lg border border-border/70 bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {data.conteudo}
                </pre>
              </ScrollArea>
            </>

          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
