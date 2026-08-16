import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  ArrowRight,
  Pencil,
  Copy,
  Mic,
  Zap,
  Clock,
  MessageSquare,
  Trash2,
  Loader2,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

import vozElliotAsset from "@/assets/voz-elliot.wav.asset.json";


import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listVapiAssistants,
  getVapiAssistant,
  createVapiAssistant,
  updateVapiAssistant,
  deleteVapiAssistant,
  duplicateVapiAssistant,
  getAssistantCardSummary,
  type VapiAssistantDTO,
  type AssistantCardSummary,
} from "@/lib/vapi.functions";

import { cn } from "@/lib/utils";

/** Limite de assistentes por conta (validado também no servidor). */
const MAX_ASSISTANTS = 4;

export const Route = createFileRoute("/_authenticated/assistentes")({
  head: () => ({
    meta: [{ title: "Assistentes Virtuais — Omniasyn" }],
  }),
  component: AssistentesPage,
});

type AssistantStatus = "Ativo" | "Rascunho" | "Pausado";
type VapiAssistant = VapiAssistantDTO;

const gradients = [
  "from-primary/40 to-primary/5",
  "from-chart-2/40 to-chart-2/5",
  "from-chart-3/40 to-chart-3/5",
  "from-chart-4/40 to-chart-4/5",
  "from-chart-5/40 to-chart-5/5",
  "from-primary/30 to-chart-2/10",
];

const statusStyles: Record<AssistantStatus, string> = {
  Ativo: "bg-success/15 text-success",
  Rascunho: "bg-muted text-muted-foreground",
  Pausado: "bg-chart-3/15 text-chart-3",
};

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const s = Math.round(sec);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}


function formatVoice(a: VapiAssistant) {
  const provider = a.voice?.provider;
  const voiceId = a.voice?.voiceId;
  if (provider && voiceId) return `${provider} • ${voiceId}`;
  if (voiceId) return voiceId;
  if (provider) return provider;
  return "Voz não configurada";
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  editingId: string | null;
  loadingInitial: boolean;
  step: 1 | 2;
  /** Padrão de IA escolhido no passo 2 (null = nenhuma escolha ainda). */
  presetId: string | null;
  name: string;
  firstMessage: string;
  systemPrompt: string;
  modelProvider: string;
  model: string;
  voiceProvider: string;
  voiceId: string;
  transcriberProvider: string;
  transcriberModel: string;
  transcriberLanguage: string;
}

const DEFAULT_MODEL_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4.1-nano";
const DEFAULT_VOICE_PROVIDER = "vapi";
const DEFAULT_VOICE_ID = "Elliot";
const DEFAULT_FIRST_MESSAGE = "Olá! Como posso te ajudar hoje?";
const DEFAULT_SYSTEM_PROMPT =
  "Você é um assistente de voz cordial e objetivo. Fale em português do Brasil, com respostas curtas e naturais.";

// Somente provedores/modelos listados em docs.vapi.ai/providers/model/*
const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3-mini"],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  groq: ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  xai: ["grok-2"],
};

// vapi/openai/deepgram têm voiceIds fixos documentados em docs.vapi.ai/providers/voice/*.
// 11labs/cartesia/playht/azure exigem voiceIds da conta do usuário (BYOK) — não hardcodamos.
const VOICE_OPTIONS: Record<string, string[]> = {
  vapi: [
    "Elliot",
    "Savannah",
    "Rohan",
    "Emma",
    "Clara",
    "Nico",
    "Kai",
    "Sagar",
    "Godfrey",
    "Neil",
    "Layla",
    "Sid",
    "Naina",
  ],
  openai: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
  deepgram: [
    "aura-2-thalia-en",
    "aura-2-orion-en",
    "aura-2-luna-en",
    "aura-2-asteria-en",
  ],
  "11labs": [],
  cartesia: [],
  playht: [],
  azure: [],
};

interface AssistantPreset {
  id: string;
  label: string;
  description: string;
  model: { provider: string; model: string };
  voice: { provider: string; voiceId: string };
  transcriber: { provider: string; model: string; language: string };
  /** Amostra de áudio da voz para o usuário escutar antes de criar. */
  sampleUrl?: string;
}

const ASSISTANT_PRESETS: AssistantPreset[] = [
  {
    id: "matteus",
    label: "Matteus",
    description: "Deepgram Nova-3 (pt-BR) · GPT-4.1 nano · Voz Elliot V2",
    model: { provider: "openai", model: "gpt-4.1-nano" },
    voice: { provider: "vapi", voiceId: "Elliot" },
    transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
    sampleUrl: vozElliotAsset.url,
  },
  {
    id: "layla",
    label: "Layla",
    description: "Deepgram Nova-2 (pt-BR) · GPT OSS 20B (Groq) · Voz Layla V2",
    model: { provider: "groq", model: "openai/gpt-oss-20b" },
    voice: { provider: "vapi", voiceId: "Layla" },
    transcriber: { provider: "deepgram", model: "nova-2", language: "pt-BR" },
  },
];

const emptyForm: FormState = {
  open: false,
  mode: "create",
  editingId: null,
  loadingInitial: false,
  step: 1,
  presetId: null,

  name: "",
  firstMessage: "",
  systemPrompt: "",
  modelProvider: DEFAULT_MODEL_PROVIDER,
  model: DEFAULT_MODEL,
  voiceProvider: DEFAULT_VOICE_PROVIDER,
  voiceId: DEFAULT_VOICE_ID,
  transcriberProvider: "deepgram",
  transcriberModel: "nova-3",
  transcriberLanguage: "multi",
};


function AssistentesPage() {
  const fetchAssistants = useServerFn(listVapiAssistants);
  const fetchAssistant = useServerFn(getVapiAssistant);
  const createAssistant = useServerFn(createVapiAssistant);
  const updateAssistant = useServerFn(updateVapiAssistant);
  const deleteAssistant = useServerFn(deleteVapiAssistant);
  const duplicateAssistant = useServerFn(duplicateVapiAssistant);

  const fetchSummary = useServerFn(getAssistantCardSummary);

  const queryClient = useQueryClient();

  // Lista cacheada: ao voltar para a página, renderiza na hora e revalida em background.
  const { data: assistantsData, isLoading } = useQuery({
    queryKey: ["assistants", "list"],
    queryFn: async () => {
      const data = await fetchAssistants();
      return Array.isArray(data) ? (data as VapiAssistant[]) : [];
    },
    staleTime: 5 * 60_000,
  });
  const assistants = useMemo(() => assistantsData ?? [], [assistantsData]);

  const [form, setForm] = useState<FormState>(emptyForm);

  // Prévia de voz: um único <audio> reaproveitado por todos os padrões.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingPresetId, setPlayingPresetId] = useState<string | null>(null);

  const stopPreview = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlayingPresetId(null);
  }, []);

  const togglePreview = useCallback(
    (preset: AssistantPreset) => {
      if (!preset.sampleUrl) return;
      const el = audioRef.current;
      if (!el) return;
      if (playingPresetId === preset.id) {
        stopPreview();
        return;
      }
      el.pause();
      el.src = preset.sampleUrl;
      el.currentTime = 0;
      void el.play().catch(() => {
        toast.error("Não foi possível reproduzir a amostra de voz.");
        setPlayingPresetId(null);
      });
      setPlayingPresetId(preset.id);
    },
    [playingPresetId, stopPreview],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VapiAssistant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["assistants", "list"] });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os assistentes da Vapi.");
    }
  }, [queryClient]);

  // Métricas reais por assistente (Vapi call logs), também cacheadas.
  const assistantIds = useMemo(
    () => assistants.map((a) => a.id).filter((id): id is string => Boolean(id)),
    [assistants],
  );

  const { data: summariesData } = useQuery({
    queryKey: ["assistants", "summaries", assistantIds],
    enabled: assistantIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const results = await Promise.all(
        assistantIds.map(async (id) => {
          try {
            const s = await fetchSummary({ data: { assistantId: id } });
            return [id, s] as const;
          } catch {
            return null;
          }
        }),
      );
      const next: Record<string, AssistantCardSummary> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      return next;
    },
  });
  const summaries = useMemo(() => summariesData ?? {}, [summariesData]);


  const enriched = useMemo(
    () =>
      assistants.map((a, i) => {
        const id = a.id ?? String(i);
        const summary = summaries[id];
        const status: AssistantStatus = "Ativo";
        return {
          raw: a,
          gradient: gradients[hashSeed(id) % gradients.length],
          metrics: {
            calls: summary?.callCount ?? 0,
            successRate: summary?.successRate ?? null,
            avgDuration: formatDuration(summary?.avgDurationSec ?? null),
            status,
            updatedAgo: relativeFromNow(summary?.lastCallAt ?? null),
            loaded: Boolean(summary),
          },
        };
      }),
    [assistants, summaries],
  );

  const total = enriched.length;
  const limitReached = total >= MAX_ASSISTANTS;
  const active = enriched.filter((a) => a.metrics.status === "Ativo").length;
  const totalCalls = enriched.reduce((s, a) => s + a.metrics.calls, 0);
  const withRate = enriched.filter((a) => a.metrics.successRate != null);
  const avgSuccess = withRate.length
    ? Math.round(
        withRate.reduce((s, a) => s + (a.metrics.successRate ?? 0), 0) / withRate.length,
      )
    : null;


  function openCreate() {
    if (limitReached) {
      toast.error(
        `Limite de ${MAX_ASSISTANTS} assistentes atingido. Exclua um para criar outro.`,
      );
      return;
    }
    setForm({
      ...emptyForm,
      open: true,
      mode: "create",
      firstMessage: DEFAULT_FIRST_MESSAGE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
  }


  async function openEdit(a: VapiAssistant) {
    setForm({
      ...emptyForm,
      open: true,
      mode: "edit",
      // Na edição o padrão já está definido pelo assistente existente.
      presetId:
        ASSISTANT_PRESETS.find(
          (p) =>
            p.model.model === a.model?.model && p.voice.voiceId === a.voice?.voiceId,
        )?.id ?? "custom",

      editingId: a.id,
      loadingInitial: true,
      name: a.name ?? "",
      firstMessage: a.firstMessage ?? "",
      systemPrompt: "",
      modelProvider: a.model?.provider ?? DEFAULT_MODEL_PROVIDER,
      model: a.model?.model ?? DEFAULT_MODEL,
      voiceProvider: a.voice?.provider ?? DEFAULT_VOICE_PROVIDER,
      voiceId: a.voice?.voiceId ?? DEFAULT_VOICE_ID,
    });
    try {
      const full = await fetchAssistant({ data: { id: a.id } });
      const systemPrompt =
        (full?.model?.messages ?? []).find(
          (m: { role?: string; content?: string }) => m?.role === "system",
        )?.content ?? "";
      setForm((prev) => ({
        ...prev,
        name: typeof full.name === "string" ? full.name : prev.name,
        firstMessage:
          typeof full.firstMessage === "string" ? full.firstMessage : prev.firstMessage,
        systemPrompt,
        modelProvider: full?.model?.provider ?? prev.modelProvider,
        model: full?.model?.model ?? prev.model,
        voiceProvider: full?.voice?.provider ?? prev.voiceProvider,
        voiceId: full?.voice?.voiceId ?? prev.voiceId,
        loadingInitial: false,
      }));
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar dados do assistente.");
      setForm((prev) => ({ ...prev, loadingInitial: false }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe um nome para o assistente.");
      return;
    }
    if (!form.presetId) {
      toast.error("Selecione um padrão de IA para continuar.");
      return;
    }
    stopPreview();

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        firstMessage: form.firstMessage,
        systemPrompt: form.systemPrompt,
        modelProvider: form.modelProvider,
        model: form.model,
        voiceProvider: form.voiceProvider,
        voiceId: form.voiceId,
        transcriberProvider: form.transcriberProvider,
        transcriberModel: form.transcriberModel,
        transcriberLanguage: form.transcriberLanguage,
      };
      if (form.mode === "create") {
        await createAssistant({ data: payload });
        toast.success("Assistente criado com sucesso.");
      } else if (form.editingId) {
        await updateAssistant({ data: { id: form.editingId, ...payload } });
        toast.success("Assistente atualizado.");
      }
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error(
        form.mode === "create"
          ? "Erro ao criar assistente."
          : "Erro ao atualizar assistente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDuplicate(a: VapiAssistant) {
    if (limitReached) {
      toast.error(
        `Limite de ${MAX_ASSISTANTS} assistentes atingido. Exclua um para duplicar outro.`,
      );
      return;
    }
    setDuplicatingId(a.id);
    const toastId = toast.loading(`Duplicando "${a.name ?? "assistente"}"...`);
    try {
      await duplicateAssistant({ data: { id: a.id } });
      toast.success("Assistente duplicado.", { id: toastId });
      await refresh();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg.includes("Limite de") ? msg : "Erro ao duplicar assistente.",
        { id: toastId },
      );
    } finally {
      setDuplicatingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAssistant({ data: { id: deleteTarget.id } });
      toast.success("Assistente excluído.");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir assistente.");
    } finally {
      setIsDeleting(false);
    }
  }


  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Assistentes Virtuais
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie, edite e monitore seus agentes de voz.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button
              className="gap-2 shadow-glow"
              onClick={openCreate}
              disabled={limitReached}
              title={
                limitReached
                  ? `Limite de ${MAX_ASSISTANTS} assistentes atingido. Exclua um para criar outro.`
                  : undefined
              }
            >
              <Plus className="h-4 w-4" />
              Novo Assistente
            </Button>
            <span
              className={cn(
                "text-[11px] text-muted-foreground",
                limitReached && "text-destructive",
              )}
            >
              {isLoading ? "—" : `${total} de ${MAX_ASSISTANTS} assistentes`}
            </span>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Assistentes", value: isLoading ? "—" : total, icon: Bot },
            { label: "Ativos agora", value: isLoading ? "—" : active, icon: Zap },
            {
              label: "Ligações (30d)",
              value: isLoading ? "—" : totalCalls.toLocaleString("pt-BR"),
              icon: MessageSquare,
            },
            { label: "Taxa média", value: isLoading ? "—" : avgSuccess != null ? `${avgSuccess}%` : "—", icon: Clock },
          ].map((k) => (
            <Card key={k.label} className="border-border bg-card/20 backdrop-blur-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <k.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar assistentes..."
              className="border-border bg-card/20 pl-9 backdrop-blur-xl"
            />
          </div>
          {["Todos", "Ativos", "Rascunhos", "Pausados"].map((f, i) => (
            <Button
              key={f}
              variant={i === 0 ? "default" : "outline"}
              size="sm"
              className={cn(
                i !== 0 &&
                  "border-border bg-card/20 backdrop-blur-xl hover:bg-primary/10 hover:text-primary",
              )}
            >
              {f}
            </Button>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <AssistantSkeleton key={i} />)
          ) : enriched.length === 0 ? (
            <Card className="col-span-full border-border bg-card/20 backdrop-blur-2xl">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum assistente encontrado na sua conta Vapi.
              </CardContent>
            </Card>
          ) : (
            enriched.map(({ raw, gradient, metrics }) => (
              <Card
                key={raw.id}
                className="group relative overflow-hidden border-border bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
                    gradient,
                  )}
                  aria-hidden
                />
                <Link
                  to="/assistants/$id"
                  params={{ id: raw.id }}
                  aria-label={`Abrir ${raw.name ?? "assistente"}`}
                  className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <CardContent className="relative space-y-4 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/60 text-primary backdrop-blur-xl">
                        <Mic className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {raw.name?.trim() || "Assistente Sem Nome"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          ID: {raw.id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="relative z-20 h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="border-border bg-card/80 backdrop-blur-2xl"
                      >
                        <DropdownMenuItem onSelect={() => openEdit(raw)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleDuplicate(raw)}
                          disabled={duplicatingId === raw.id || limitReached}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setDeleteTarget(raw)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-semibold",
                        statusStyles[metrics.status],
                      )}
                    >
                      {metrics.status}
                    </span>
                    <span className="truncate text-muted-foreground">{formatVoice(raw)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background/40 p-3 backdrop-blur-xl">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Ligações
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {metrics.calls.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Sucesso
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {metrics.successRate != null ? `${metrics.successRate}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Duração
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {metrics.avgDuration}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Atualizado {metrics.updatedAgo}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary transition-all group-hover:border-primary/60 group-hover:bg-primary/20 group-hover:shadow-glow">
                      Abrir & configurar
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  {duplicatingId === raw.id && (
                    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/50 backdrop-blur-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={form.open}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          if (!open) stopPreview();
          setForm((f) => ({ ...f, open }));
        }}
      >
        <DialogContent className="max-w-lg border-border bg-card/80 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.mode === "create" ? "Novo Assistente" : "Editar Assistente"}
            </DialogTitle>
            <DialogDescription>
              {form.step === 1
                ? "Passo 1 de 2 · Comportamento do agente."
                : "Passo 2 de 2 · Modelo & Voz."}
            </DialogDescription>
            {/* Stepper */}
            <div className="mt-3 flex items-center gap-2">
              <StepDot active={form.step >= 1} label="Comportamento" />
              <div className="h-px flex-1 bg-foreground/[0.04]" />
              <StepDot active={form.step >= 2} label="Modelo & Voz" />
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {form.step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="assistant-name">Nome do Assistente</Label>
                  <Input
                    id="assistant-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Sofia • SDR"
                    disabled={form.loadingInitial}
                    required
                    className="border-border bg-background/40 backdrop-blur-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-first">Primeira Mensagem</Label>
                  <Textarea
                    id="assistant-first"
                    value={form.firstMessage}
                    onChange={(e) => setForm((f) => ({ ...f, firstMessage: e.target.value }))}
                    placeholder="Olá, como posso ajudar?"
                    rows={2}
                    disabled={form.loadingInitial}
                    className="border-border bg-background/40 backdrop-blur-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-prompt">System Prompt / Instruções</Label>
                  <Textarea
                    id="assistant-prompt"
                    value={form.systemPrompt}
                    onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                    placeholder="Descreva o papel, tom e regras do assistente..."
                    rows={7}
                    disabled={form.loadingInitial}
                    className="border-border bg-background/40 backdrop-blur-xl"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Escolha um padrão de IA pré-configurado e escute a voz antes de
                  concluir. Mais opções em breve.
                </p>
                {ASSISTANT_PRESETS.map((preset) => {
                  const selected = form.presetId === preset.id;
                  const isPlaying = playingPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          presetId: preset.id,
                          modelProvider: preset.model.provider,
                          model: preset.model.model,
                          voiceProvider: preset.voice.provider,
                          voiceId: preset.voice.voiceId,
                          transcriberProvider: preset.transcriber.provider,
                          transcriberModel: preset.transcriber.model,
                          transcriberLanguage: preset.transcriber.language,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setForm((f) => ({
                            ...f,
                            presetId: preset.id,
                            modelProvider: preset.model.provider,
                            model: preset.model.model,
                            voiceProvider: preset.voice.provider,
                            voiceId: preset.voice.voiceId,
                            transcriberProvider: preset.transcriber.provider,
                            transcriberModel: preset.transcriber.model,
                            transcriberLanguage: preset.transcriber.language,
                          }));
                        }
                      }}
                      className={`w-full cursor-pointer rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-primary/60 bg-primary/[0.08] shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
                          : "border-border bg-background/40 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{preset.label}</div>
                        <div className="flex items-center gap-2">
                          {selected && (
                            <span className="text-[10px] uppercase tracking-wider text-primary">
                              Selecionado
                            </span>
                          )}
                          {preset.sampleUrl && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePreview(preset);
                              }}
                              className="h-8 gap-1.5 border-border bg-card/40 text-xs backdrop-blur-xl"
                            >
                              {isPlaying ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                              {isPlaying ? "Parar" : "Escutar voz"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {preset.description}
                      </p>
                    </div>
                  );
                })}
                {!form.presetId && (
                  <p className="text-xs text-amber-500">
                    Selecione um padrão de IA para continuar.
                  </p>
                )}
                <audio
                  ref={audioRef}
                  onEnded={() => setPlayingPresetId(null)}
                  className="hidden"
                />
              </div>

            )}
            <DialogFooter>
              {form.step === 2 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stopPreview();
                    setForm((f) => ({ ...f, step: 1 }));
                  }}
                  disabled={isSubmitting}
                  className="border-border bg-card/20 backdrop-blur-xl"
                >
                  Voltar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stopPreview();
                    setForm(emptyForm);
                  }}
                  disabled={isSubmitting}
                  className="border-border bg-card/20 backdrop-blur-xl"
                >
                  Cancelar
                </Button>
              )}
              {form.step === 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (!form.name.trim()) {
                      toast.error("Informe um nome para o assistente.");
                      return;
                    }
                    setForm((f) => ({ ...f, step: 2 }));
                  }}
                  disabled={isSubmitting || form.loadingInitial}
                  className="gap-2"
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting || form.loadingInitial || !form.presetId}
                  className="gap-2"
                >

                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.mode === "create" ? "Criar Assistente" : "Salvar Alterações"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !isDeleting && !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="border-border bg-card/80 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir assistente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O assistente{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name ?? "Sem Nome"}
              </span>{" "}
              será removido da sua conta Vapi e não poderá ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir definitivamente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          active
            ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
            : "flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background/40 text-[10px] font-semibold text-muted-foreground"
        }
      >
        {active ? "•" : ""}
      </span>
      <span className={active ? "text-xs font-medium text-foreground" : "text-xs text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function AssistantSkeleton() {
  return (
    <Card className="relative overflow-hidden border-border bg-card/20 backdrop-blur-2xl">
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl bg-foreground/10" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32 bg-foreground/10" />
              <Skeleton className="h-3 w-20 bg-foreground/10" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-md bg-foreground/10" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14 rounded-full bg-foreground/10" />
          <Skeleton className="h-3 w-32 bg-foreground/10" />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background/40 p-3 backdrop-blur-xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-14 bg-foreground/10" />
              <Skeleton className="h-3.5 w-12 bg-foreground/10" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24 bg-foreground/10" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md bg-foreground/10" />
            <Skeleton className="h-8 w-8 rounded-md bg-foreground/10" />
            <Skeleton className="h-8 w-8 rounded-md bg-foreground/10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
