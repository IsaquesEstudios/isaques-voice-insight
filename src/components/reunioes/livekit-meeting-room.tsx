import { useCallback, useEffect, useRef, useState } from "react";
import {
  Chat,
  ControlBar,
  LayoutContextProvider,
  LiveKitRoom,
  RoomAudioRenderer,
  useCreateLayoutContext,
  useIsMuted,
  useIsSpeaking,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { ParticipantKind, RoomEvent, Track } from "livekit-client";
import type { Participant } from "livekit-client";
import type {
  TrackReference,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-core";
import "@livekit/components-styles";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  MoreVertical,
  Presentation,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { callLivekitMeetingAgent, setMeetingPresenter } from "@/lib/livekit.functions";
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

// ---------------------------------------------------------------------------
// Estado de apresentação: gravado na metadata da sala (replicada pelo LiveKit
// para todos os participantes em tempo real).
// ---------------------------------------------------------------------------

interface RoomMetaState {
  presenter: string | null;
  allowed: string[];
}

function parseRoomMeta(raw: string | undefined): RoomMetaState {
  if (!raw) return { presenter: null, allowed: [] };
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    return {
      presenter: typeof j.presenter === "string" ? j.presenter : null,
      allowed: Array.isArray(j.allowed)
        ? j.allowed.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return { presenter: null, allowed: [] };
  }
}

function participantRole(p: Participant): "host" | "guest" {
  try {
    return JSON.parse(p.metadata ?? "{}").role === "host" ? "host" : "guest";
  } catch {
    return "guest";
  }
}

/** Escuta a metadata da sala e reage a mudanças em tempo real. */
function useRoomMeta(): RoomMetaState {
  const room = useRoomContext();
  const [meta, setMeta] = useState<RoomMetaState>(() => parseRoomMeta(room.metadata));
  useEffect(() => {
    const update = () => setMeta(parseRoomMeta(room.metadata));
    update();
    room.on(RoomEvent.RoomMetadataChanged, update);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, update);
    };
  }, [room]);
  return meta;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function tileKey(t: TrackReferenceOrPlaceholder): string {
  return `${t.participant.identity}:${String(t.source)}`;
}

// ---------------------------------------------------------------------------
// Tile de participante: vídeo sem corte (object-contain, adapta câmera em
// pé ou deitada), avatar quando sem câmera, indicadores e menu do organizador.
// ---------------------------------------------------------------------------

interface TileHostControls {
  busy: boolean;
  allowed: boolean;
  onTogglePresent: () => void;
  onToggleAllow: () => void;
}

interface MeetingTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  isSelf: boolean;
  isPresenter: boolean;
  hostControls?: TileHostControls;
  /** Chamado quando a proporção real do vídeo muda (usado no palco de foco). */
  onRatio?: (ratio: number) => void;
}

function MeetingTile({ trackRef, isSelf, isPresenter, hostControls, onRatio }: MeetingTileProps) {
  const { participant, publication, source } = trackRef;
  const isScreen = source === Track.Source.ScreenShare;
  const hasVideo = !!publication && !publication.isMuted && !!publication.track;
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const speaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onRatio) return;
    const root = rootRef.current;
    if (!root) return;
    let video: HTMLVideoElement | null = null;
    const update = () => {
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        onRatio(video.videoWidth / video.videoHeight);
      }
    };
    const attach = () => {
      const v = root.querySelector("video");
      if (v === video) return;
      video?.removeEventListener("resize", update);
      video = v;
      if (video) {
        video.addEventListener("resize", update);
        update();
      }
    };
    attach();
    const mo = new MutationObserver(attach);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      video?.removeEventListener("resize", update);
    };
  }, [onRatio, trackRef]);

  return (
    <div
      ref={rootRef}
      className={`group relative h-full w-full overflow-hidden rounded-lg bg-muted ring-2 transition-shadow ${
        isPresenter
          ? "ring-primary"
          : speaking && !micMuted
            ? "ring-primary/70"
            : "ring-transparent"
      }`}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef as TrackReference}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
            {initials(isScreen ? name : name)}
          </div>
        </div>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-background/75 px-2 py-0.5 text-xs text-foreground backdrop-blur-sm">
        {!isScreen &&
          (micMuted ? (
            <MicOff className="h-3 w-3 text-destructive" />
          ) : (
            <Mic className="h-3 w-3" />
          ))}
        <span className="max-w-[140px] truncate">
          {isScreen ? `Tela de ${name}` : name}
          {isSelf && !isScreen ? " (você)" : ""}
        </span>
      </div>

      {isPresenter && (
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          <Presentation className="h-3 w-3" />
          Apresentando
        </div>
      )}

      {hostControls && !isSelf && (
        <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Opções para ${name}`}
                className="grid h-7 w-7 place-items-center rounded-md bg-background/75 text-foreground backdrop-blur-sm hover:bg-background"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={hostControls.onTogglePresent}
                disabled={hostControls.busy}
              >
                <Presentation className="mr-2 h-4 w-4" />
                {isPresenter ? "Encerrar apresentação" : "Colocar em apresentação"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={hostControls.onToggleAllow}
                disabled={hostControls.busy}
              >
                {hostControls.allowed ? (
                  <UserX className="mr-2 h-4 w-4" />
                ) : (
                  <UserCheck className="mr-2 h-4 w-4" />
                )}
                {hostControls.allowed
                  ? "Remover permissão de apresentar"
                  : "Permitir apresentar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade: encolhe os tiles conforme entram participantes e pagina quando
// passa do limite visual (ninguém sai da sala, só da página atual).
// ---------------------------------------------------------------------------

const GRID_PAGE_SIZE = 12;

interface StageProps {
  tracks: TrackReferenceOrPlaceholder[];
  myIdentity: string;
  isHost: boolean;
  meta: RoomMetaState;
  presentBusy: boolean;
  onSetPresenter: (identity: string | null) => void;
  onToggleAllow: (identity: string) => void;
}

function GridStage(props: StageProps) {
  const { tracks } = props;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(tracks.length / GRID_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = tracks.slice(current * GRID_PAGE_SIZE, current * GRID_PAGE_SIZE + GRID_PAGE_SIZE);
  const n = Math.max(visible.length, 1);
  const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);

  return (
    <div className="relative h-full w-full">
      <div
        className="grid h-full w-full gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {visible.map((t) => (
          <MeetingTile
            key={tileKey(t)}
            trackRef={t}
            isSelf={t.participant.identity === props.myIdentity}
            isPresenter={props.meta.presenter === t.participant.identity}
            onRatio={undefined}
            hostControls={
              props.isHost
                ? {
                    busy: props.presentBusy,
                    allowed: props.meta.allowed.includes(t.participant.identity),
                    onTogglePresent: () =>
                      props.onSetPresenter(
                        props.meta.presenter === t.participant.identity
                          ? null
                          : t.participant.identity,
                      ),
                    onToggleAllow: () => props.onToggleAllow(t.participant.identity),
                  }
                : undefined
            }
          />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-background/85 px-1 py-0.5 text-xs text-foreground shadow ring-1 ring-border backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Página anterior de participantes"
            onClick={() => setPage((current - 1 + pageCount) % pageCount)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-8 text-center tabular-nums">
            {current + 1}/{pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Próxima página de participantes"
            onClick={() => setPage((current + 1) % pageCount)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Palco de foco: apresentador (ou compartilhamento de tela) em destaque,
// com proporção real do vídeo (câmera deitada ocupa o palco inteiro em
// largura) e os demais em uma faixa inferior.
// ---------------------------------------------------------------------------

interface FocusStageProps extends StageProps {
  focus: TrackReferenceOrPlaceholder;
  others: TrackReferenceOrPlaceholder[];
}

function FocusStage(props: FocusStageProps) {
  const { focus, others } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setStageSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleRatio = useCallback((r: number) => setRatio(r), []);
  const clamped = Math.min(Math.max(ratio, 0.5), 2.4);
  const w = stageSize.h > 0 ? Math.min(stageSize.w, stageSize.h * clamped) : 0;
  const h = w > 0 ? w / clamped : 0;

  const hostControlsFor = (t: TrackReferenceOrPlaceholder): TileHostControls | undefined =>
    props.isHost
      ? {
          busy: props.presentBusy,
          allowed: props.meta.allowed.includes(t.participant.identity),
          onTogglePresent: () =>
            props.onSetPresenter(
              props.meta.presenter === t.participant.identity ? null : t.participant.identity,
            ),
          onToggleAllow: () => props.onToggleAllow(t.participant.identity),
        }
      : undefined;

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <div ref={stageRef} className="relative min-h-0 flex-1">
        {w > 0 && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: Math.round(w), height: Math.round(h) }}
          >
            <MeetingTile
              trackRef={focus}
              isSelf={focus.participant.identity === props.myIdentity}
              isPresenter={props.meta.presenter === focus.participant.identity}
              onRatio={handleRatio}
              hostControls={hostControlsFor(focus)}
            />
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="flex h-24 shrink-0 gap-2 overflow-x-auto">
          {others.map((t) => (
            <div key={tileKey(t)} className="h-full w-40 shrink-0">
              <MeetingTile
                trackRef={t}
                isSelf={t.participant.identity === props.myIdentity}
                isPresenter={props.meta.presenter === t.participant.identity}
                hostControls={hostControlsFor(t)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo da sala (dentro do LiveKitRoom): grade/palco + barra de controle.
// ---------------------------------------------------------------------------

function MeetingRoomContent({
  session,
  onAgentJoined,
}: {
  session: MeetingSession;
  onAgentJoined: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const meta = useRoomMeta();
  const applyPresenter = useServerFn(setMeetingPresenter);
  const [presentBusy, setPresentBusy] = useState(false);
  const layoutContext = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(false);

  const me = room.localParticipant;
  const myIdentity = me.identity;
  const isHost = participantRole(me) === "host";
  const canPresent = isHost || meta.allowed.includes(myIdentity);

  const applyMeta = async (next: RoomMetaState) => {
    setPresentBusy(true);
    try {
      await applyPresenter({
        data: {
          code: session.roomName,
          token: session.token,
          presenter: next.presenter,
          allowed: next.allowed,
        },
      });
    } catch (e) {
      toast.error(translateError(e, "Não foi possível atualizar a apresentação."));
    } finally {
      setPresentBusy(false);
    }
  };

  const handleSetPresenter = (identity: string | null) => {
    void applyMeta({ ...meta, presenter: identity });
  };

  const handleToggleAllow = (identity: string) => {
    const allowed = meta.allowed.includes(identity)
      ? meta.allowed.filter((x) => x !== identity)
      : [...meta.allowed, identity];
    void applyMeta({ ...meta, allowed });
  };

  // Avisos em tempo real: permissão recebida e início de apresentação.
  const prevAllowedRef = useRef<string[] | null>(null);
  useEffect(() => {
    const prev = prevAllowedRef.current;
    prevAllowedRef.current = meta.allowed;
    if (prev && !prev.includes(myIdentity) && meta.allowed.includes(myIdentity)) {
      toast.success("O organizador liberou você para apresentar.");
    }
  }, [meta.allowed, myIdentity]);

  const prevPresenterRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevPresenterRef.current;
    prevPresenterRef.current = meta.presenter;
    if (prev === undefined || prev === meta.presenter) return;
    if (meta.presenter && meta.presenter !== myIdentity) {
      const p = participants.find((x) => x.identity === meta.presenter);
      toast.info(`${p?.name ?? "Um participante"} está apresentando.`);
    }
  }, [meta.presenter, participants, myIdentity]);

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const screenshare = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const presenterTrack = meta.presenter
    ? tracks.find(
        (t) =>
          t.source === Track.Source.Camera && t.participant.identity === meta.presenter,
      )
    : undefined;
  // Tela compartilhada tem prioridade no palco; senão, o apresentador.
  const focus = screenshare ?? presenterTrack;
  const others = focus ? tracks.filter((t) => t !== focus) : [];

  const presenterName = meta.presenter
    ? (participants.find((p) => p.identity === meta.presenter)?.name ?? meta.presenter)
    : null;
  const showStopPresent =
    !!meta.presenter && (meta.presenter === myIdentity || isHost);
  const showStartPresent = !meta.presenter && canPresent;

  return (
    <LayoutContextProvider
      value={layoutContext}
      onWidgetChange={(state) => setShowChat(!!state.showChat)}
    >
      <AgentPresence onJoined={onAgentJoined} />
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {focus ? (
              <FocusStage
                focus={focus}
                others={others}
                tracks={tracks}
                myIdentity={myIdentity}
                isHost={isHost}
                meta={meta}
                presentBusy={presentBusy}
                onSetPresenter={handleSetPresenter}
                onToggleAllow={handleToggleAllow}
              />
            ) : (
              <GridStage
                tracks={tracks}
                myIdentity={myIdentity}
                isHost={isHost}
                meta={meta}
                presentBusy={presentBusy}
                onSetPresenter={handleSetPresenter}
                onToggleAllow={handleToggleAllow}
              />
            )}

            {(showStartPresent || showStopPresent || (presenterName && meta.presenter !== myIdentity)) && (
              <div className="pointer-events-none absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-2">
                {presenterName && meta.presenter !== myIdentity && (
                  <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1 text-xs text-foreground shadow ring-1 ring-border backdrop-blur-sm">
                    <Presentation className="h-3 w-3 text-primary" />
                    {presenterName} está apresentando
                  </span>
                )}
                {showStopPresent && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto gap-2 shadow"
                    disabled={presentBusy}
                    onClick={() => handleSetPresenter(null)}
                  >
                    {presentBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Encerrar apresentação
                  </Button>
                )}
                {showStartPresent && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto gap-2 shadow"
                    disabled={presentBusy}
                    onClick={() => handleSetPresenter(myIdentity)}
                  >
                    {presentBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Presentation className="h-4 w-4" />
                    )}
                    Apresentar
                  </Button>
                )}
              </div>
            )}
          </div>

          {showChat && (
            <div className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium">Chat da reunião</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Fechar chat"
                  onClick={() => setShowChat(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Chat className="min-h-0 flex-1" />
            </div>
          )}
        </div>

        <ControlBar
          variation="minimal"
          controls={{ chat: true, settings: true }}
          className="justify-center border-t border-border bg-background py-1"
        />
      </div>
      <RoomAudioRenderer />
    </LayoutContextProvider>
  );
}

interface Props {
  session: MeetingSession;
  onLeave: () => void;
}

/**
 * Sala de reunião LiveKit compartilhada entre o painel (usuário logado) e a
 * rota pública de convidados. Grade adaptativa com paginação, modo
 * apresentação controlado pelo organizador, cópia de código/link e o botão
 * "Chamar IA".
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
          <MeetingRoomContent
            session={session}
            onAgentJoined={() => setAiState("joined")}
          />
        </LiveKitRoom>
      </CardContent>
    </Card>
  );
}
