import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  Play,
  FileText,
  Plus,
  Pencil,
  Trash2,
  PhoneForwarded,
  PhoneOff,
  Hash,
  Code2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
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
  modelProvider: "",
  model: "",
  voiceProvider: "",
  voiceId: "",
  status: "Rascunho",
};

function AssistantDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchAssistant = useServerFn(getVapiAssistant);
  const saveConfig = useServerFn(saveVapiAssistantConfig);

  const [form, setForm] = useState<FormState>(empty);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tools, setTools] = useState<any[]>([]);
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
          modelProvider: typeof a?.model?.provider === "string" ? a.model.provider : "",
          model: typeof a?.model?.model === "string" ? a.model.model : "",
          voiceProvider: typeof a?.voice?.provider === "string" ? a.voice.provider : "",
          voiceId: typeof a?.voice?.voiceId === "string" ? a.voice.voiceId : "",
          status: typeof a.name === "string" && a.name.trim() ? "Ativo" : "Rascunho",
        });
        setTools(Array.isArray(a?.tools) ? a.tools : []);
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
                          <SelectValue placeholder="Selecione..." />
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
                          <SelectValue placeholder="Selecione..." />
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
                          <SelectValue placeholder="Selecione..." />
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
                          <SelectValue placeholder="Selecione..." />
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

          <TabsContent value="logs" className="mt-0">
            <LogsTab />
          </TabsContent>
          <TabsContent value="tools" className="mt-0">
            <ToolsTab
              id={id}
              tools={tools}
              onToolsChange={setTools}
              isLoading={isLoading}
            />
          </TabsContent>
          <TabsContent value="analysis" className="mt-0">
            <AnalysisTab />
          </TabsContent>
          <TabsContent value="advanced" className="mt-0">
            <AdvancedTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

/* -------------------------------- Logs -------------------------------- */

interface LogRow {
  id: string;
  when: string;
  phone: string;
  duration: string;
  cost: string;
}

const MOCK_LOGS: LogRow[] = [
  { id: "1", when: "06/07/2026 14:32", phone: "+55 11 98765-4321", duration: "03:12", cost: "$0.42" },
  { id: "2", when: "06/07/2026 13:58", phone: "+55 21 99123-4567", duration: "01:47", cost: "$0.24" },
  { id: "3", when: "06/07/2026 12:15", phone: "+55 31 98888-1122", duration: "05:03", cost: "$0.68" },
  { id: "4", when: "06/07/2026 11:02", phone: "+1 415 555-2201", duration: "02:21", cost: "$0.31" },
  { id: "5", when: "05/07/2026 19:44", phone: "+55 11 97777-9090", duration: "00:38", cost: "$0.09" },
];

function LogsTab() {
  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Histórico do Agente</h2>
            <p className="text-xs text-muted-foreground">
              Últimas interações registradas por este assistente.
            </p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur-xl">
            Dados de exemplo
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Data/Hora
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Telefone
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Duração
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Custo
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_LOGS.map((row) => (
              <TableRow
                key={row.id}
                className="border-white/[0.04] transition-colors hover:bg-white/[0.03]"
              >
                <TableCell className="text-sm text-foreground">{row.when}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.phone}
                </TableCell>
                <TableCell className="text-sm text-foreground">{row.duration}</TableCell>
                <TableCell className="text-sm text-foreground">{row.cost}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:text-primary"
                      aria-label="Reproduzir áudio"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:text-primary"
                      aria-label="Ver transcrição"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Tools -------------------------------- */

type VapiToolType = "transferCall" | "endCall" | "dtmf" | "function";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VapiTool = Record<string, any> & { type: VapiToolType };

const TOOL_TYPES: { value: VapiToolType; label: string; description: string; icon: typeof PhoneForwarded; gradient: string }[] = [
  { value: "transferCall", label: "Transferir Ligação", description: "Encaminha para um número externo.", icon: PhoneForwarded, gradient: "from-primary/30 to-primary/5" },
  { value: "endCall", label: "Encerrar Ligação", description: "Permite que a IA finalize a chamada.", icon: PhoneOff, gradient: "from-chart-2/30 to-chart-2/5" },
  { value: "dtmf", label: "Teclado (DTMF)", description: "Envia tons DTMF durante a chamada.", icon: Hash, gradient: "from-chart-3/30 to-chart-3/5" },
  { value: "function", label: "Função Customizada", description: "Chama seu webhook com parâmetros.", icon: Code2, gradient: "from-chart-5/30 to-chart-5/5" },
];

const DEFAULT_FN_PARAMS = `{
  "type": "object",
  "properties": {
    "example": {
      "type": "string",
      "description": "Descreva este parâmetro"
    }
  },
  "required": []
}`;

function toolMeta(type: string) {
  return (
    TOOL_TYPES.find((t) => t.value === type) ?? {
      value: type as VapiToolType,
      label: type,
      description: "Ferramenta customizada.",
      icon: Code2,
      gradient: "from-muted/30 to-muted/5",
    }
  );
}

function toolTitle(tool: VapiTool): string {
  if (tool.type === "function") {
    return tool.function?.name ?? "function";
  }
  return tool.type;
}

interface ToolsTabProps {
  id: string;
  tools: VapiTool[];
  onToolsChange: (tools: VapiTool[]) => void;
  isLoading: boolean;
}

function ToolsTab({ id, tools, onToolsChange, isLoading }: ToolsTabProps) {
  const saveConfig = useServerFn(saveVapiAssistantConfig);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [type, setType] = useState<VapiToolType>("function");
  const [transferNumber, setTransferNumber] = useState("");
  const [fnName, setFnName] = useState("");
  const [fnDescription, setFnDescription] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [fnParams, setFnParams] = useState(DEFAULT_FN_PARAMS);

  function resetForm() {
    setType("function");
    setTransferNumber("");
    setFnName("");
    setFnDescription("");
    setServerUrl("");
    setFnParams(DEFAULT_FN_PARAMS);
  }

  function buildTool(): VapiTool | null {
    if (type === "transferCall") {
      const number = transferNumber.trim();
      if (!number) {
        toast.error("Informe o número de destino.");
        return null;
      }
      return {
        type: "transferCall",
        destinations: [{ type: "number", number }],
      };
    }
    if (type === "endCall" || type === "dtmf") {
      return { type };
    }
    // function
    const name = fnName.trim();
    if (!name || /\s/.test(name)) {
      toast.error("Nome da função é obrigatório e não pode conter espaços.");
      return null;
    }
    let parameters: unknown;
    try {
      parameters = JSON.parse(fnParams);
    } catch {
      toast.error("JSON Schema inválido no campo de parâmetros.");
      return null;
    }
    if (
      !parameters ||
      typeof parameters !== "object" ||
      (parameters as { type?: string }).type !== "object"
    ) {
      toast.error('Parameters deve ser um JSON Schema com "type": "object".');
      return null;
    }
    const tool: VapiTool = {
      type: "function",
      function: {
        name,
        description: fnDescription.trim(),
        parameters,
      },
    };
    if (serverUrl.trim()) {
      tool.server = { url: serverUrl.trim() };
    }
    return tool;
  }

  async function handleSubmit() {
    const newTool = buildTool();
    if (!newTool) return;
    setIsSubmitting(true);
    try {
      const nextTools = [...tools, newTool];
      await saveConfig({ data: { id, tools: nextTools } });
      onToolsChange(nextTools);
      toast.success("Ferramenta adicionada.");
      setOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar ferramenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(index: number) {
    const nextTools = tools.filter((_, i) => i !== index);
    try {
      await saveConfig({ data: { id, tools: nextTools } });
      onToolsChange(nextTools);
      toast.success("Ferramenta removida.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover ferramenta.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ferramentas do Agente</h2>
          <p className="text-xs text-muted-foreground">
            Funções que o assistente pode invocar durante a chamada.
          </p>
        </div>
        <Button
          className="gap-2 shadow-glow"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
          Adicionar Ferramenta
        </Button>
      </div>

      {tools.length === 0 && !isLoading && (
        <p className="rounded-xl border border-dashed border-white/[0.08] bg-background/20 p-8 text-center text-xs text-muted-foreground">
          Nenhuma ferramenta configurada. Clique em "Adicionar Ferramenta" para começar.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool, index) => {
          const meta = toolMeta(tool.type);
          const Icon = meta.icon;
          return (
            <Card
              key={index}
              className="group relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
                  meta.gradient,
                )}
                aria-hidden
              />
              <CardContent className="relative space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-background/60 text-primary backdrop-blur-xl">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir ferramenta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {toolTitle(tool)}
                  </p>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-card/90 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Ferramenta</DialogTitle>
            <DialogDescription>
              Configure uma nova ferramenta seguindo o schema oficial da Vapi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Ferramenta</Label>
              <Select value={type} onValueChange={(v) => setType(v as VapiToolType)}>
                <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                  {TOOL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {TOOL_TYPES.find((t) => t.value === type)?.description}
              </p>
            </div>

            {type === "transferCall" && (
              <div className="space-y-2">
                <Label htmlFor="transfer-number">Número de Destino</Label>
                <Input
                  id="transfer-number"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="+5511999999999"
                  className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Formato E.164, ex.: +5511999999999.
                </p>
              </div>
            )}

            {(type === "endCall" || type === "dtmf") && (
              <p className="rounded-lg border border-white/[0.06] bg-background/30 p-3 text-xs text-muted-foreground backdrop-blur-xl">
                Este tipo de ferramenta não exige parâmetros adicionais. Ao salvar, será
                enviado apenas <span className="font-mono text-foreground">{`{ type: "${type}" }`}</span>.
              </p>
            )}

            {type === "function" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="fn-name">function.name</Label>
                  <Input
                    id="fn-name"
                    value={fnName}
                    onChange={(e) => setFnName(e.target.value.replace(/\s+/g, ""))}
                    placeholder="get_availability"
                    className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fn-desc">function.description</Label>
                  <Textarea
                    id="fn-desc"
                    rows={2}
                    value={fnDescription}
                    onChange={(e) => setFnDescription(e.target.value)}
                    placeholder="Explique para a IA quando e como usar essa função."
                    className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server-url">server.url</Label>
                  <Input
                    id="server-url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://seu-dominio.com/webhook"
                    className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fn-params">function.parameters (JSON Schema)</Label>
                  <Textarea
                    id="fn-params"
                    rows={10}
                    value={fnParams}
                    onChange={(e) => setFnParams(e.target.value)}
                    spellCheck={false}
                    className="border-white/[0.08] bg-background/40 font-mono text-[11px] backdrop-blur-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Deve ser um JSON Schema válido com <span className="font-mono">"type": "object"</span>.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- Analysis ------------------------------- */

interface SchemaField {
  id: string;
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
}

function AnalysisTab() {
  const [successCriteria, setSuccessCriteria] = useState(
    "A ligação é considerada bem-sucedida quando o lead demonstra interesse claro no produto e concorda em receber um contato do time comercial.",
  );
  const [fields, setFields] = useState<SchemaField[]>([
    { id: "f1", name: "nome", type: "string", description: "Nome completo do lead" },
    { id: "f2", name: "email", type: "string", description: "E-mail principal para contato" },
    { id: "f3", name: "orcamento", type: "number", description: "Orçamento estimado em BRL" },
  ]);

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        id: `f${Date.now()}`,
        name: "",
        type: "string",
        description: "",
      },
    ]);
  }

  function updateField(id: string, patch: Partial<SchemaField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-4">
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Critério de Sucesso</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Descreva em linguagem natural quando a IA deve marcar a ligação como convertida.
          </p>
          <Textarea
            rows={5}
            value={successCriteria}
            onChange={(e) => setSuccessCriteria(e.target.value)}
            className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
          />
        </CardContent>
      </Card>

      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Extração de Dados</h2>
              <p className="text-xs text-muted-foreground">
                Campos que a IA deve capturar automaticamente durante a chamada.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addField} className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl">
              <Plus className="h-3.5 w-3.5" />
              Adicionar Campo
            </Button>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_140px_1.5fr_40px] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground md:grid">
              <span>Nome do campo</span>
              <span>Tipo</span>
              <span>Descrição</span>
              <span />
            </div>
            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 p-4 text-center text-xs text-muted-foreground">
                Nenhum campo definido. Clique em "Adicionar Campo" para começar.
              </p>
            )}
            {fields.map((field) => (
              <div
                key={field.id}
                className="grid grid-cols-1 gap-2 rounded-xl border border-white/[0.06] bg-background/30 p-3 backdrop-blur-xl md:grid-cols-[1fr_140px_1.5fr_40px]"
              >
                <Input
                  value={field.name}
                  onChange={(e) => updateField(field.id, { name: e.target.value })}
                  placeholder="ex: telefone"
                  className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                />
                <Select
                  value={field.type}
                  onValueChange={(v) =>
                    updateField(field.id, { type: v as SchemaField["type"] })
                  }
                >
                  <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={field.description}
                  onChange={(e) => updateField(field.id, { description: e.target.value })}
                  placeholder="Explique o que a IA deve capturar"
                  className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeField(field.id)}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  aria-label="Remover campo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Advanced ------------------------------- */

function AdvancedTab() {
  const [maxDuration, setMaxDuration] = useState(30);
  const [silenceTimeout, setSilenceTimeout] = useState(20);
  const [backgroundSound, setBackgroundSound] = useState("office");
  const [recording, setRecording] = useState(true);
  const [hipaa, setHipaa] = useState(false);
  const [endCallOnSilence, setEndCallOnSilence] = useState(true);

  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardContent className="space-y-6 p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Configurações Avançadas</h2>
          <p className="text-xs text-muted-foreground">
            Ajustes finos de comportamento e privacidade da chamada.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-background/30 p-4 backdrop-blur-xl">
            <Label htmlFor="max-duration">Duração Máxima da Chamada (min)</Label>
            <Input
              id="max-duration"
              type="number"
              min={1}
              value={maxDuration}
              onChange={(e) => setMaxDuration(Number(e.target.value))}
              className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              A ligação é encerrada automaticamente após este tempo.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-background/30 p-4 backdrop-blur-xl">
            <Label htmlFor="silence">Tempo de Silêncio para Desligar (s)</Label>
            <Input
              id="silence"
              type="number"
              min={1}
              value={silenceTimeout}
              onChange={(e) => setSilenceTimeout(Number(e.target.value))}
              className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              Encerra a chamada após o intervalo sem áudio do cliente.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-background/30 p-4 backdrop-blur-xl">
            <Label>Som de Fundo</Label>
            <Select value={backgroundSound} onValueChange={setBackgroundSound}>
              <SelectTrigger className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="static">Static</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Ruído ambiente que torna a conversa mais natural.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-background/30 p-4 backdrop-blur-xl">
            <Label>Privacidade & Gravação</Label>
            <ToggleRow
              label="Gravar Ligações"
              description="Armazena o áudio completo para reprodução posterior."
              checked={recording}
              onChange={setRecording}
            />
            <ToggleRow
              label="Modo HIPAA"
              description="Não persiste transcrições nem áudios sensíveis."
              checked={hipaa}
              onChange={setHipaa}
            />
            <ToggleRow
              label="Desligar em silêncio prolongado"
              description="Aplica o timeout de silêncio configurado ao lado."
              checked={endCallOnSilence}
              onChange={setEndCallOnSilence}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
