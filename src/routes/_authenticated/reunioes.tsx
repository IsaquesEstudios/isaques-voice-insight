import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Video, Copy, Check, LogOut, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/reunioes")({
  head: () => ({
    meta: [
      { title: "Reunião em vídeo" },
      { name: "description", content: "Crie e entre em salas de reunião em vídeo." },
    ],
  }),
  component: ReunioesPage,
});

const JITSI_DOMAIN = "meet.jit.si";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

function loadJitsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.JitsiMeetExternalAPI) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-jitsi="external-api"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Jitsi")));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://${JITSI_DOMAIN}/external_api.js`;
    s.async = true;
    s.dataset.jitsi = "external-api";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Jitsi"));
    document.body.appendChild(s);
  });
}

function generateRoomName() {
  const adjectives = ["rapido", "sereno", "brilhante", "vivo", "audaz", "leve"];
  const nouns = ["encontro", "sala", "briefing", "call", "sync", "papo"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const id = Math.random().toString(36).slice(2, 8);
  return `isaques-${a}-${n}-${id}`;
}

function ReunioesPage() {
  const [displayName, setDisplayName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    if (!activeRoom || !containerRef.current) return;
    let disposed = false;
    let api: any;

    loadJitsiScript()
      .then(() => {
        if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        containerRef.current.innerHTML = "";
        api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: activeRoom,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: displayName ? { displayName } : undefined,
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: "#0b0b12",
          },
        });
        apiRef.current = api;
        api.addListener("readyToClose", () => {
          setActiveRoom(null);
        });
      })
      .catch((err: Error) => {
        toast.error(err.message ?? "Erro ao iniciar reunião");
        setActiveRoom(null);
      });

    return () => {
      disposed = true;
      try {
        api?.dispose?.();
        apiRef.current?.dispose?.();
      } catch {
        /* noop */
      }
      apiRef.current = null;
    };
  }, [activeRoom, displayName]);

  const handleCreate = () => {
    const name = generateRoomName();
    setRoomInput(name);
    setActiveRoom(name);
  };

  const handleJoin = () => {
    const name = roomInput.trim().replace(/\s+/g, "-");
    if (!name) {
      toast.error("Informe um nome para a sala");
      return;
    }
    setActiveRoom(name);
  };

  const handleLeave = () => {
    setActiveRoom(null);
  };

  const handleCopyLink = async () => {
    if (!activeRoom) return;
    const url = `https://${JITSI_DOMAIN}/${activeRoom}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
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

        {!activeRoom ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Criar nova sala
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Seu nome</Label>
                  <Input
                    id="displayName"
                    placeholder="Como você quer aparecer"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full gap-2">
                  <Video className="h-4 w-4" />
                  Iniciar reunião agora
                </Button>
                <p className="text-xs text-muted-foreground">
                  A sala é gerada com um nome único e você pode compartilhar o link com convidados.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Entrar em uma sala
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">Nome da sala</Label>
                  <Input
                    id="roomName"
                    placeholder="ex: reuniao-comercial-terca"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoin();
                    }}
                  />
                </div>
                <Button onClick={handleJoin} variant="secondary" className="w-full">
                  Entrar
                </Button>
                <p className="text-xs text-muted-foreground">
                  Use o mesmo nome que outro participante para se encontrar na mesma sala.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{activeRoom}</CardTitle>
                <p className="truncate text-xs text-muted-foreground">
                  https://{JITSI_DOMAIN}/{activeRoom}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar link
                </Button>
                <Button variant="destructive" size="sm" onClick={handleLeave} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={containerRef}
                className="h-[70vh] w-full bg-black"
                aria-label="Sala de vídeo"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
