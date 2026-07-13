import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pencil,
  Copy,
  Mic,
  Zap,
  Clock,
  MessageSquare,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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
  type VapiAssistantDTO,
} from "@/lib/vapi.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistentes")({
  head: () => ({
    meta: [{ title: "Assistentes Virtuais — Isaques Estúdios | AI Voice" }],
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

function mockMetrics(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const calls = 200 + (h % 3200);
  const success = 60 + (h % 36);
  const secs = 60 + (h % 240);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const statuses: AssistantStatus[] = ["Ativo", "Ativo", "Ativo", "Pausado", "Rascunho"];
  const status = statuses[h % statuses.length];
  return {
    calls,
    successRate: status === "Rascunho" ? 0 : success,
    avgDuration: status === "Rascunho" ? "—" : `${mm}:${ss}`,
    status,
    updatedAgo: `há ${1 + (h % 48)}h`,
  };
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
  name: string;
  firstMessage: string;
  systemPrompt: string;
  modelProvider: string;
  model: string;
  voiceProvider: string;
  voiceId: string;
}

const DEFAULT_MODEL_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4.1";
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
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
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

const emptyForm: FormState = {
  open: false,
  mode: "create",
  editingId: null,
  loadingInitial: false,
  step: 1,
  name: "",
  firstMessage: "",
  systemPrompt: "",
  modelProvider: DEFAULT_MODEL_PROVIDER,
  model: DEFAULT_MODEL,
  voiceProvider: DEFAULT_VOICE_PROVIDER,
  voiceId: DEFAULT_VOICE_ID,
};


function AssistentesPage() {
  const fetchAssistants = useServerFn(listVapiAssistants);
  const fetchAssistant = useServerFn(getVapiAssistant);
  const createAssistant = useServerFn(createVapiAssistant);
  const updateAssistant = useServerFn(updateVapiAssistant);
  const deleteAssistant = useServerFn(deleteVapiAssistant);
  const duplicateAssistant = useServerFn(duplicateVapiAssistant);

  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VapiAssistant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAssistants();
      setAssistants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os assistentes da Vapi.");
    }
  }, [fetchAssistants]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enriched = useMemo(
    () =>
      assistants.map((a, i) => ({
        raw: a,
        gradient: gradients[i % gradients.length],
        metrics: mockMetrics(a.id ?? String(i)),
      })),
    [assistants],
  );

  const total = enriched.length;
  const active = enriched.filter((a) => a.metrics.status === "Ativo").length;
  const totalCalls = enriched.reduce((s, a) => s + a.metrics.calls, 0);
  const withRate = enriched.filter((a) => a.metrics.successRate > 0);
  const avgSuccess = withRate.length
    ? Math.round(withRate.reduce((s, a) => s + a.metrics.successRate, 0) / withRate.length)
    : 0;

  function openCreate() {
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
    setDuplicatingId(a.id);
    const toastId = toast.loading(`Duplicando "${a.name ?? "assistente"}"...`);
    try {
      await duplicateAssistant({ data: { id: a.id } });
      toast.success("Assistente duplicado.", { id: toastId });
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao duplicar assistente.", { id: toastId });
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

  function handlePlay() {
    toast.info(
      "Integração de Web Call ativa via SDK. O teste de voz será habilitado em breve.",
    );
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
          <Button className="gap-2 shadow-glow" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo Assistente
          </Button>
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
            { label: "Taxa média", value: isLoading ? "—" : `${avgSuccess}%`, icon: Clock },
          ].map((k) => (
            <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
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
              className="border-white/[0.08] bg-card/20 pl-9 backdrop-blur-xl"
            />
          </div>
          {["Todos", "Ativos", "Rascunhos", "Pausados"].map((f, i) => (
            <Button
              key={f}
              variant={i === 0 ? "default" : "outline"}
              size="sm"
              className={cn(
                i !== 0 &&
                  "border-white/[0.08] bg-card/20 backdrop-blur-xl hover:bg-primary/10 hover:text-primary",
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
            <Card className="col-span-full border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum assistente encontrado na sua conta Vapi.
              </CardContent>
            </Card>
          ) : (
            enriched.map(({ raw, gradient, metrics }) => (
              <Card
                key={raw.id}
                className="group relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
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
                        className="border-white/[0.08] bg-card/80 backdrop-blur-2xl"
                      >
                        <DropdownMenuItem onSelect={() => openEdit(raw)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleDuplicate(raw)}
                          disabled={duplicatingId === raw.id}
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

                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
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
                        {metrics.successRate > 0 ? `${metrics.successRate}%` : "—"}
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
                    <div className="relative z-20 flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:text-primary"
                        onClick={handlePlay}
                        aria-label="Testar assistente"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:text-primary"
                        onClick={() => openEdit(raw)}
                        aria-label="Editar assistente"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:text-primary"
                        onClick={() => handleDuplicate(raw)}
                        disabled={duplicatingId === raw.id}
                        aria-label="Duplicar assistente"
                      >
                        {duplicatingId === raw.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={form.open}
        onOpenChange={(open) => !isSubmitting && setForm((f) => ({ ...f, open }))}
      >
        <DialogContent className="max-w-lg border-white/[0.08] bg-card/80 backdrop-blur-2xl">
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
              <div className="h-px flex-1 bg-white/[0.08]" />
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
                    className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
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
                    className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
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
                    className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
                  />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Provedor do Modelo</Label>
                  <Select
                    value={form.modelProvider}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        modelProvider: v,
                        model: MODEL_OPTIONS[v]?.[0] ?? "",
                      }))
                    }
                    disabled={form.loadingInitial}
                  >
                    <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(MODEL_OPTIONS).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modelo de IA</Label>
                  <Select
                    value={form.model}
                    onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}
                    disabled={form.loadingInitial}
                  >
                    <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(MODEL_OPTIONS[form.modelProvider] ?? []).map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      {form.model &&
                        !(MODEL_OPTIONS[form.modelProvider] ?? []).includes(form.model) && (
                          <SelectItem value={form.model}>{form.model}</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Provedor de Voz</Label>
                  <Select
                    value={form.voiceProvider}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        voiceProvider: v,
                        voiceId: VOICE_OPTIONS[v]?.[0] ?? "",
                      }))
                    }
                    disabled={form.loadingInitial}
                  >
                    <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(VOICE_OPTIONS).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Voz</Label>
                  <Select
                    value={form.voiceId}
                    onValueChange={(v) => setForm((f) => ({ ...f, voiceId: v }))}
                    disabled={form.loadingInitial}
                  >
                    <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(VOICE_OPTIONS[form.voiceProvider] ?? []).map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                      {form.voiceId &&
                        !(VOICE_OPTIONS[form.voiceProvider] ?? []).includes(form.voiceId) && (
                          <SelectItem value={form.voiceId}>{form.voiceId}</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              {form.step === 2 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm((f) => ({ ...f, step: 1 }))}
                  disabled={isSubmitting}
                  className="border-white/[0.08] bg-card/20 backdrop-blur-xl"
                >
                  Voltar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(emptyForm)}
                  disabled={isSubmitting}
                  className="border-white/[0.08] bg-card/20 backdrop-blur-xl"
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
                  disabled={isSubmitting || form.loadingInitial}
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
        <AlertDialogContent className="border-white/[0.08] bg-card/80 backdrop-blur-2xl">
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
            : "flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] bg-background/40 text-[10px] font-semibold text-muted-foreground"
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
    <Card className="relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl bg-white/10" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14 rounded-full bg-white/10" />
          <Skeleton className="h-3 w-32 bg-white/10" />
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-14 bg-white/10" />
              <Skeleton className="h-3.5 w-12 bg-white/10" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24 bg-white/10" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
            <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
            <Skeleton className="h-8 w-8 rounded-md bg-white/10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
