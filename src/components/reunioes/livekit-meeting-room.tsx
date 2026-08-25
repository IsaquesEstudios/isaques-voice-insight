import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ControlBar,
  LayoutContextProvider,
  LiveKitRoom,
  RoomAudioRenderer,
  useChat,
  useConnectionState,
  useCreateLayoutContext,
  useIsMuted,
  useIsSpeaking,
  useMediaDeviceSelect,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import {
  ConnectionState,
  DisconnectReason,
  ParticipantKind,
  RoomEvent,
  Track,
} from "livekit-client";
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
  MessageSquare,
  Mic,
  MicOff,
  MoreVertical,
  PhoneOff,
  Presentation,
  Send,
  Settings,
  UserCheck,
  UserX,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  callLivekitMeetingAgent,
  endLivekitMeeting,
  getMeetingState,
  setMeetingPresenter,
} from "@/lib/livekit.functions";
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
  useEffect(() => {
    if (present) onJoined();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);
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

/**
 * Papel do participante local lido direto do JWT da sala — disponível antes
 * mesmo de a conexão terminar (a metadata do participant só chega depois).
 */
function roleFromToken(token: string): "host" | "guest" {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      metadata?: string;
    };
    return JSON.parse(payload.metadata ?? "{}").role === "host" ? "host" : "guest";
  } catch {
    return "guest";
  }
}

/**
 * Estado de apresentação da sala. Usa o evento RoomMetadataChanged quando o
 * servidor replica a metadata, com polling de 3s como fallback (nem todo
 * servidor LiveKit empurra RoomUpdate para os participantes).
 */
function useRoomMeta(roomName: string): [RoomMetaState, (m: RoomMetaState) => void] {
  const room = useRoomContext();
  const fetchState = useServerFn(getMeetingState);
  const [meta, setMeta] = useState<RoomMetaState>(() => parseRoomMeta(room.metadata));
  useEffect(() => {
    const update = () => setMeta(parseRoomMeta(room.metadata));
    update();
    room.on(RoomEvent.RoomMetadataChanged, update);
    const poll = async () => {
      try {
        const s = await fetchState({ data: { code: roomName } });
        setMeta((prev) =>
          prev.presenter === s.presenter && prev.allowed.join("|") === s.allowed.join("|")
            ? prev
            : s,
        );
      } catch {
        /* sala encerrada ou falha de rede — ignora e tenta no próximo ciclo */
      }
    };
    const id = setInterval(poll, 3000);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, update);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomName]);
  return [meta, setMeta];
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
// pé ou deitada), avatar quando sem câmera, coroa no organizador,
// indicadores e menu do organizador.
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
  const isHostTile = !isScreen && participantRole(participant) === "host";

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
            {initials(name)}
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
        {isHostTile && (
          <span role="img" aria-label="Organizador" title="Organizador">
            👑
          </span>
        )}
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
// Chat lateral (estilo Google Meet): painel próprio, fora do "balão" de
// vídeo, ocupando toda a altura da reunião. Construído com useChat para
// controlar 100% do layout/cores (o <Chat> padrão do LiveKit trazia um
// fundo cinza e um grid que cortava o conteúdo). Fica sempre montado para
// preservar o histórico de mensagens da sala.
// ---------------------------------------------------------------------------

function MeetingChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const room = useRoomContext();
  const myIdentity = room.localParticipant.identity;
  const { send, chatMessages, isSending } = useChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Só permite enviar com a sala realmente conectada — evita envios que
  // ficam pendentes enquanto a conexão WebRTC ainda está sendo estabelecida.
  const connected = useConnectionState(room) === ConnectionState.Connected;

  useEffect(() => {
    const el = listRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, open]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    try {
      await send(text);
    } catch (e) {
      setDraft(text);
      toast.error(translateError(e, "Não foi possível enviar a mensagem."));
    }
  };

  return (
    <Card
      className={`${
        open ? "flex" : "hidden"
      } h-[60vh] w-full flex-col overflow-hidden lg:h-auto lg:w-[360px] lg:shrink-0`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">Chat da reunião</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Fechar chat"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {chatMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              Nenhuma mensagem ainda.
              <br />
              Envie a primeira para todos da sala.
            </p>
          </div>
        ) : (
          chatMessages.map((m, i) => {
            const own = m.from?.identity === myIdentity;
            const name = own
              ? "Você"
              : m.from?.name || m.from?.identity || "Participante";
            const time = new Date(m.timestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={m.id ?? `${m.timestamp}-${i}`}
                className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}
              >
                <span className="px-1 text-[11px] text-muted-foreground">
                  {name} · {time}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                    own
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem…"
          aria-label="Escreva uma mensagem"
          className="h-9"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!draft.trim() || isSending}
          aria-label="Enviar mensagem"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Configurações da reunião: seleção de microfone, câmera e alto-falante
// (o menu de configurações padrão da ControlBar ficava cortado dentro do
// cartão e não abria). Usa useMediaDeviceSelect, que já troca o dispositivo
// ativo da sala em tempo real.
// ---------------------------------------------------------------------------

function DeviceSelectField({
  kind,
  label,
}: {
  kind: "audioinput" | "videoinput" | "audiooutput";
  label: string;
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind,
    requestPermissions: true,
  });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={activeDeviceId || undefined}
        onValueChange={(v) =>
          void setActiveMediaDevice(v).catch((e) =>
            toast.error(translateError(e, "Não foi possível trocar o dispositivo.")),
          )
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Dispositivo padrão" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((d, i) => (
            <SelectItem
              key={d.deviceId || `${kind}-${i}`}
              value={d.deviceId || `${kind}-${i}`}
            >
              {d.label || `${label} ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {devices.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum dispositivo encontrado. Verifique as permissões do navegador.
        </p>
      )}
    </div>
  );
}

function MeetingSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de áudio e vídeo</DialogTitle>
          <DialogDescription>
            Escolha quais dispositivos usar nesta reunião. A troca é aplicada
            na hora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <DeviceSelectField kind="audioinput" label="Microfone" />
          <DeviceSelectField kind="videoinput" label="Câmera" />
          <DeviceSelectField kind="audiooutput" label="Alto-falante" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Palco da reunião (grade/palco + barra de controle). O chat NÃO fica aqui:
// ele é um cartão irmão, fora do "balão" de vídeo.
// ---------------------------------------------------------------------------

function MeetingStage({
  session,
  onAgentJoined,
}: {
  session: MeetingSession;
  onAgentJoined: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [meta, setMetaLocal] = useRoomMeta(session.roomName);
  const applyPresenter = useServerFn(setMeetingPresenter);
  const [presentBusy, setPresentBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      // Atualização otimista: o polling (3s) confirma o estado do servidor.
      setMetaLocal(next);
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

  const rawTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  // Durante a publicação, o SDK pode emitir placeholder + track real da mesma
  // fonte ao mesmo tempo — manter um só por participante/fonte (real primeiro).
  const seenKeys = new Set<string>();
  const tracks = [...rawTracks]
    .sort((a, b) => Number(!!b.publication?.track) - Number(!!a.publication?.track))
    .filter((t) => {
      const k = tileKey(t);
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      return true;
    });

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
    <div className="flex h-[70vh] min-h-0 flex-col">
      <AgentPresence onJoined={onAgentJoined} />
      <div className="relative min-h-0 flex-1">
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

      <div className="relative border-t border-border bg-background">
        <ControlBar
          variation="minimal"
          controls={{ chat: true, settings: false }}
          className="justify-center py-1"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <button
            type="button"
            aria-label="Configurações de áudio e vídeo"
            title="Configurações de áudio e vídeo"
            onClick={() => setShowSettings(true)}
            className="lk-button"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
      <MeetingSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <RoomAudioRenderer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tela de fim de reunião (compartilhada entre painel e rota de convidado).
// ---------------------------------------------------------------------------

export function MeetingEndedScreen({
  actionLabel,
  onAction,
}: {
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <Card className="w-full max-w-md border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-center">
        <CardHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
            <PhoneOff className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">Reunião encerrada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O organizador encerrou a reunião e todos os participantes foram
            desconectados.
          </p>
          <Button onClick={onAction} size="lg" className="w-full gap-2">
            <Video className="h-4 w-4" />
            {actionLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sala completa: cabeçalho (código, link, IA, sair/encerrar), palco de vídeo
// e o chat como cartão separado ao lado (fora do "balão" da reunião).
// ---------------------------------------------------------------------------

interface Props {
  session: MeetingSession;
  onLeave: () => void;
  /** Chamado quando a reunião é encerrada para todos (sala apagada). */
  onEnded?: () => void;
}

export function LivekitMeetingRoom({ session, onLeave, onEnded }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [showChat, setShowChat] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const callAgent = useServerFn(callLivekitMeetingAgent);
  const endMeeting = useServerFn(endLivekitMeeting);

  // O papel vem do próprio token da sala — disponível antes de conectar.
  const isHost = useMemo(() => roleFromToken(session.token) === "host", [session.token]);

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

  const handleEndMeeting = async () => {
    setEnding(true);
    try {
      await endMeeting({ data: { code: session.roomName, token: session.token } });
      // DeleteRoom desconecta todos; para o organizador, vamos direto à tela final.
      onEnded?.();
    } catch (e) {
      toast.error(translateError(e, "Não foi possível encerrar a reunião."));
    } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  };

  return (
    <>
      <LiveKitRoom
        token={session.token}
        serverUrl={session.serverUrl}
        connect
        audio
        video
        data-lk-theme="default"
        className="lk-room-container block w-full"
        onDisconnected={(reason) => {
          // Sala apagada pelo organizador → tela de fim de reunião.
          if (reason === DisconnectReason.ROOM_DELETED) onEnded?.();
          else onLeave();
        }}
        onError={(e) =>
          toast.error(translateError(e, "Erro na conexão da reunião."))
        }
      >
        <MeetingShell
          session={session}
          isHost={isHost}
          aiState={aiState}
          copied={copied}
          copiedCode={copiedCode}
          showChat={showChat}
          ending={ending}
          onAgentJoined={() => setAiState("joined")}
          onCopyCode={handleCopyCode}
          onCopyLink={handleCopyLink}
          onCallAgent={handleCallAgent}
          onChatChange={setShowChat}
          onLeave={onLeave}
          onRequestEnd={() => setConfirmEnd(true)}
        />
      </LiveKitRoom>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar reunião para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os participantes serão desconectados e a sala será
              apagada. Essa ação não pode ser desfeita — para continuar,
              será preciso criar uma nova reunião.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleEndMeeting();
              }}
              disabled={ending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {ending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="mr-2 h-4 w-4" />
              )}
              Encerrar para todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shell interno (dentro do LiveKitRoom): provê o LayoutContext usado pelo
// botão de chat da ControlBar e organiza cabeçalho + palco + chat lateral.
// ---------------------------------------------------------------------------

interface ShellProps {
  session: MeetingSession;
  isHost: boolean;
  aiState: AiState;
  copied: boolean;
  copiedCode: boolean;
  showChat: boolean;
  ending: boolean;
  onAgentJoined: () => void;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onCallAgent: () => void;
  onChatChange: (open: boolean) => void;
  onLeave: () => void;
  onRequestEnd: () => void;
}

function MeetingShell(props: ShellProps) {
  const layoutContext = useCreateLayoutContext();

  return (
    <LayoutContextProvider
      value={layoutContext}
      onWidgetChange={(state) => props.onChatChange(!!state.showChat)}
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Código da reunião</p>
              <CardTitle className="truncate font-mono text-base">
                {props.session.roomName}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={props.onCopyCode} className="gap-2">
                {props.copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copiar código
              </Button>
              <Button variant="outline" size="sm" onClick={props.onCopyLink} className="gap-2">
                {props.copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copiar link
              </Button>
              {props.aiState === "joined" ? (
                <Button variant="outline" size="sm" disabled className="gap-2">
                  <Check className="h-4 w-4" />
                  IA na sala
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={props.onCallAgent}
                  disabled={props.aiState === "calling" || props.aiState === "waiting"}
                  className="gap-2"
                >
                  {props.aiState === "calling" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                  {props.aiState === "waiting" ? "IA a caminho…" : "Chamar IA"}
                </Button>
              )}
              {props.isHost && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={props.onRequestEnd}
                  disabled={props.ending}
                  className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <PhoneOff className="h-4 w-4" />
                  Encerrar
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={props.onLeave} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <Card className="min-w-0 flex-1 overflow-hidden">
            <CardContent className="p-0">
              <MeetingStage
                session={props.session}
                onAgentJoined={props.onAgentJoined}
              />
            </CardContent>
          </Card>

          <MeetingChat
            open={props.showChat}
            onClose={() => props.onChatChange(false)}
          />
        </div>
      </div>
    </LayoutContextProvider>
  );
}
