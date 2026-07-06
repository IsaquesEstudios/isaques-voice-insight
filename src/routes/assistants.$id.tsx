import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  ScrollText,
  Wrench,
  LineChart,
  Settings2,
  Save,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getVapiAssistant,
  saveVapiAssistantConfig,
} from "@/lib/vapi.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistants/$id")({
  head: () => ({
    meta: [{ title: "Detalhes do Assistente — Isaques Estúdios | AI Voice" }],
  }),
  component: AssistantDetailPage,
});

const MODEL_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "groq", label: "Groq" },
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4", label: "gpt-4" },
    { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "claude-3.5-sonnet" },
    { value: "claude-3-haiku-20240307", label: "claude-3-haiku" },
  ],
  google: [
    { value: "gemini-1.5-pro", label: "gemini-1.5-pro" },
    { value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
  ],
  groq: [
    { value: "llama-3.1-70b-versatile", label: "llama-3.1-70b" },
    { value: "mixtral-8x7b-32768", label: "mixtral-8x7b" },
  ],
};

const VOICE_PROVIDERS = [
  { value: "11labs", label: "ElevenLabs" },
  { value: "cartesia", label: "Cartesia" },
  { value: "openai", label: "OpenAI" },
  { value: "azure", label: "Azure" },
];

const VOICES_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  "11labs": [
    { value: "burt", label: "Burt" },
    { value: "rachel", label: "Rachel" },
    { value: "adam", label: "Adam" },
    { value: "domi", label: "Domi" },
  ],
  cartesia: [
    { value: "sonic-english", label: "Sonic English" },
    { value: "sonic-multilingual", label: "Sonic Multilingual" },
  ],
  openai: [
    { value: "alloy", label: "Alloy" },
    { value: "echo", label: "Echo" },
    { value: "nova", label: "Nova" },
    { value: "shimmer", label: "Shimmer" },
  ],
  azure: [
    { value: "en-US-JennyNeural", label: "Jenny (EN-US)" },
    { value: "pt-BR-FranciscaNeural", label: "Francisca (PT-BR)" },
  ],
};

interface FormState {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  modelProvider: string;
  model: string;
  voiceProvider: string;
  voiceId: string;
  status: "Ativo" | "Rascunho";
}

const empty: FormState = {
  name: "",
  firstMessage: "",
  systemPrompt: "",
  modelProvider: "openai",
  model: "gpt-4o",
  voiceProvider: "11labs",
  voiceId: "burt",
  status: "Ativo",
};

function AssistantDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchAssistant = useServerFn(getVapiAssistant);
  const saveConfig = useServerFn(saveVapiAssistantConfig);

  const [form, setForm] = useState<FormState>(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const a = await fetchAssistant({ data: { id } });
        if (cancelled) return;
        const systemPrompt =
          (a?.model?.messages ?? []).find(
            (m: { role?: string; content?: string }) => m?.role === "system",
          )?.content ?? "";
        setForm({
          name: typeof a.name === "string" ? a.name : "",
          firstMessage: typeof a.firstMessage === "string" ? a.firstMessage : "",
          systemPrompt,
          modelProvider: a?.model?.provider ?? "openai",
          model: a?.model?.model ?? "gpt-4o",
          voiceProvider: a?.voice?.provider ?? "11labs",
          voiceId: a?.voice?.voiceId ?? "burt",
          status: typeof a.name === "string" && a.name.trim() ? "Ativo" : "Rascunho",
        });
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível carregar o assistente.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchAssistant]);

  const modelOptions = MODELS_BY_PROVIDER[form.modelProvider] ?? [];
  const voiceOptions = VOICES_BY_PROVIDER[form.voiceProvider] ?? [];

  async function handleSave() {
    setIsSaving(true);
    try {
      await saveConfig({
        data: {
          id,
          name: form.name,
          firstMessage: form.firstMessage,
          systemPrompt: form.systemPrompt,
          modelProvider: form.modelProvider,
          model: form.model,
          voiceProvider: form.voiceProvider,
          voiceId: form.voiceId,
        },
      });
      toast.success("Alterações salvas.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: "/assistentes" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Assistentes
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-64 bg-white/10" />
                <Skeleton className="h-3 w-40 bg-white/10" />
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                    {form.name?.trim() || "Assistente Sem Nome"}
                  </h1>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      form.status === "Ativo"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {form.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">ID: {id}</p>
              </>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="gap-2 bg-success text-success-foreground hover:bg-success/90"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Alterações
          </Button>
        </div>

        <Tabs defaultValue="assistant" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-white/[0.08] bg-card/20 p-1 backdrop-blur-2xl">
            {[
              { value: "assistant", label: "Assistant", icon: Brain },
              { value: "logs", label: "Logs", icon: ScrollText },
              { value: "tools", label: "Tools", icon: Wrench },
              { value: "analysis", label: "Analysis", icon: LineChart },
              { value: "advanced", label: "Advanced", icon: Settings2 },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-success data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-success data-[state=active]:rounded-none"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="assistant" className="mt-0">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Coluna Esquerda — Comportamento */}
              <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
                <CardContent className="space-y-5 p-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Comportamento</h2>
                    <p className="text-xs text-muted-foreground">
                      Defina como o assistente inicia e conduz a conversa.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      disabled={isLoading}
                      className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="first">Primeira Mensagem</Label>
                    <Textarea
                      id="first"
                      rows={3}
                      value={form.firstMessage}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstMessage: e.target.value }))
                      }
                      disabled={isLoading}
                      placeholder="Olá, como posso ajudar?"
                      className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prompt">System Prompt</Label>
                    <Textarea
                      id="prompt"
                      rows={14}
                      value={form.systemPrompt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, systemPrompt: e.target.value }))
                      }
                      disabled={isLoading}
                      placeholder="Descreva o papel, tom e regras do assistente..."
                      className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Coluna Direita — Modelo & Voz */}
              <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
                <CardContent className="space-y-5 p-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Modelo & Voz</h2>
                    <p className="text-xs text-muted-foreground">
                      Escolha o cérebro e o timbre do agente.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Provedor do Modelo</Label>
                      <Select
                        value={form.modelProvider}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            modelProvider: v,
                            model: MODELS_BY_PROVIDER[v]?.[0]?.value ?? "",
                          }))
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                          {MODEL_PROVIDERS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select
                        value={form.model}
                        onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                          {modelOptions.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                          {!modelOptions.some((m) => m.value === form.model) &&
                            form.model && (
                              <SelectItem value={form.model}>{form.model}</SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Provedor de Voz</Label>
                      <Select
                        value={form.voiceProvider}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            voiceProvider: v,
                            voiceId: VOICES_BY_PROVIDER[v]?.[0]?.value ?? "",
                          }))
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                          {VOICE_PROVIDERS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Voz / Voice ID</Label>
                      <Select
                        value={form.voiceId}
                        onValueChange={(v) => setForm((f) => ({ ...f, voiceId: v }))}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                          {voiceOptions.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.label}
                            </SelectItem>
                          ))}
                          {!voiceOptions.some((v) => v.value === form.voiceId) &&
                            form.voiceId && (
                              <SelectItem value={form.voiceId}>{form.voiceId}</SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-background/40 p-4 text-xs text-muted-foreground backdrop-blur-xl">
                    Configurações avançadas de temperatura, tokens e transcrição estarão
                    disponíveis na aba <span className="text-foreground">Advanced</span>.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {[
            { value: "logs", label: "Logs" },
            { value: "tools", label: "Tools" },
            { value: "analysis", label: "Analysis" },
            { value: "advanced", label: "Advanced" },
          ].map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              <BlankState label={tab.label} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function BlankState({ label }: { label: string }) {
  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm font-medium text-foreground">
          Configurações de {label} em breve
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Estamos preparando esta seção. Em breve você poderá gerenciar {label.toLowerCase()}{" "}
          diretamente por aqui.
        </p>
        <Link
          to="/assistentes"
          className="mt-4 text-xs text-primary underline-offset-4 hover:underline"
        >
          Voltar para a lista
        </Link>
      </CardContent>
    </Card>
  );
}
