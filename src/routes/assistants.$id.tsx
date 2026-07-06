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
  Voicemail,
  Hash,
  MessageSquare,
  MessageCircle,
  Radio,
  Shuffle,
  Search,
  Plug,
  ServerCog,
  Slack,
  Sheet,
  Code2,
  Sparkles,
  Phone,
  PhoneOff as PhoneOffIcon,
  Info,
  Globe,
  Lock,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDown } from "lucide-react";
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
  listVapiAssistants,
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
        setTools(
          Array.isArray(a?.model?.tools)
            ? a.model.tools
            : Array.isArray(a?.tools)
              ? a.tools
              : [],
        );
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

type VapiToolType = "transferCall" | "endCall" | "dtmf" | "voicemail" | "sms" | "sipRequest" | "handoff" | "query" | "apiRequest" | "mcp" | "slack" | "sheets" | "function";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VapiTool = Record<string, any> & { type: string };

type CatalogKind = VapiToolType | "comingSoon";

interface CatalogItem {
  key: string;
  label: string;
  description: string;
  icon: typeof PhoneForwarded;
  iconColor: string; // tailwind text color class
  iconBg: string; // tailwind bg color class
  kind: CatalogKind;
  vapiType?: VapiToolType;
}

interface CatalogSection {
  title: string;
  items: CatalogItem[];
}

const TOOL_CATALOG: CatalogSection[] = [
  {
    title: "Phone Call Tools",
    items: [
      { key: "transferCall", label: "Transfer Call", description: "Encaminha a ligação para um número externo.", icon: PhoneForwarded, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", kind: "transferCall", vapiType: "transferCall" },
      { key: "endCall", label: "Hang Up", description: "Permite que a IA finalize a chamada.", icon: PhoneOff, iconColor: "text-rose-400", iconBg: "bg-rose-500/10", kind: "endCall", vapiType: "endCall" },
      { key: "voicemail", label: "Leave Voicemail", description: "Deixa uma mensagem quando ninguém atender.", icon: Voicemail, iconColor: "text-violet-400", iconBg: "bg-violet-500/10", kind: "voicemail", vapiType: "voicemail" },
      { key: "dtmf", label: "DTMF", description: "Envia tons DTMF durante a chamada.", icon: Hash, iconColor: "text-amber-400", iconBg: "bg-amber-500/10", kind: "dtmf", vapiType: "dtmf" },
      { key: "sendText", label: "Send Text", description: "Envia SMS durante ou após a chamada.", icon: MessageSquare, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", kind: "sms", vapiType: "sms" },
      { key: "sip", label: "SIP Request", description: "Executa requisições SIP customizadas.", icon: Radio, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", kind: "sipRequest", vapiType: "sipRequest" },
    ],
  },
  {
    title: "Assistant Tools",
    items: [
      { key: "handoff", label: "Handoff", description: "Transfere a conversa para outro assistente.", icon: Shuffle, iconColor: "text-orange-400", iconBg: "bg-orange-500/10", kind: "handoff", vapiType: "handoff" },
      { key: "query", label: "Query", description: "Consulta base de conhecimento indexada.", icon: Search, iconColor: "text-blue-500", iconBg: "bg-blue-500/10", kind: "query", vapiType: "query" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { key: "apiRequest", label: "API Request", description: "Chama seu webhook com parâmetros customizados.", icon: Plug, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", kind: "apiRequest", vapiType: "apiRequest" },
      { key: "mcp", label: "MCP", description: "Conecta a um servidor Model Context Protocol.", icon: ServerCog, iconColor: "text-red-400", iconBg: "bg-red-500/10", kind: "mcp", vapiType: "mcp" },
      { key: "slack", label: "Slack", description: "Envia mensagens e notificações para o Slack.", icon: Slack, iconColor: "text-purple-500", iconBg: "bg-purple-500/10", kind: "slack", vapiType: "slack" },
      { key: "sheets", label: "Google Sheets", description: "Lê e escreve em planilhas do Google.", icon: Sheet, iconColor: "text-green-500", iconBg: "bg-green-500/10", kind: "sheets", vapiType: "sheets" },
    ],
  },
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

function findCatalogItemByVapiType(type: string): CatalogItem | undefined {
  // Normalize namespaced Vapi tool types (e.g. slack.message.send) to catalog keys.
  const normalized = type.startsWith("slack.")
    ? "slack"
    : type.startsWith("google.sheets.")
      ? "sheets"
      : type;
  for (const section of TOOL_CATALOG) {
    for (const item of section.items) {
      if (item.vapiType === normalized) return item;
    }
  }
  return undefined;
}

function toolCardMeta(tool: VapiTool) {
  const item = findCatalogItemByVapiType(tool.type);
  if (item) return item;
  return {
    label: tool.type,
    icon: Code2,
    iconColor: "text-muted-foreground",
    iconBg: "bg-muted/20",
  } as Pick<CatalogItem, "label" | "icon" | "iconColor" | "iconBg">;
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

type TransferDestination =
  | { type: "number"; number: string }
  | { type: "sip"; sipUri: string };

type TransferMessageType =
  | "request-start"
  | "request-complete"
  | "request-failed"
  | "request-response-delayed";

interface TransferMessage {
  type: TransferMessageType;
  content: string;
}

const TRANSFER_MESSAGE_LABELS: Record<TransferMessageType, string> = {
  "request-start": "Request Start Variant",
  "request-complete": "Request Complete",
  "request-failed": "Request Failed",
  "request-response-delayed": "Request Response Delayed",
};

const END_CALL_MESSAGE_TYPES = [
  "request-start",
  "request-complete",
  "request-failed",
] as const;
type EndCallMessageType = (typeof END_CALL_MESSAGE_TYPES)[number];

const END_CALL_MESSAGE_LABELS: Record<EndCallMessageType, string> = {
  "request-start": "Request Start",
  "request-complete": "Request Complete",
  "request-failed": "Request Failed",
};

type EndCallMessageMode = "default" | "none" | "custom";

interface EndCallMessage {
  type: EndCallMessageType;
  mode: EndCallMessageMode;
  content: string;
  blocking: boolean;
}

type VoicemailScriptMode = "assistant" | "custom" | "skip";

interface VoicemailMessage {
  type: TransferMessageType;
  content: string;
}

function ToolsTab({ id, tools, onToolsChange, isLoading }: ToolsTabProps) {
  const saveConfig = useServerFn(saveVapiAssistantConfig);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [transferNumber, setTransferNumber] = useState("");
  const [fnName, setFnName] = useState("");
  const [fnDescription, setFnDescription] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [fnParams, setFnParams] = useState(DEFAULT_FN_PARAMS);

  // transferCall configuration state
  const [tcName, setTcName] = useState("transferCall");
  const [tcDescription, setTcDescription] = useState("");
  const [tcDestinations, setTcDestinations] = useState<TransferDestination[]>([]);
  const [tcMessages, setTcMessages] = useState<TransferMessage[]>([]);

  // endCall configuration state
  const [ecName, setEcName] = useState("endCall");
  const [ecDescription, setEcDescription] = useState("");
  const [ecMessages, setEcMessages] = useState<EndCallMessage[]>([]);

  // voicemail configuration state
  const [vmName, setVmName] = useState("voicemail_tool");
  const [vmDescription, setVmDescription] = useState("");
  const [vmScriptMode, setVmScriptMode] = useState<VoicemailScriptMode>("assistant");
  const [vmScriptContent, setVmScriptContent] = useState("");
  const [vmBeepDetection, setVmBeepDetection] = useState(false);
  const [vmMessages, setVmMessages] = useState<VoicemailMessage[]>([]);

  // dtmf configuration state
  const [dtName, setDtName] = useState("dtmf_tool");
  const [dtDescription, setDtDescription] = useState("");
  const [dtSipInfo, setDtSipInfo] = useState(false);
  const [dtMessages, setDtMessages] = useState<VoicemailMessage[]>([]);

  // sms configuration state
  const [smsName, setSmsName] = useState("send_text_tool");
  const [smsDescription, setSmsDescription] = useState("");
  const [smsToPreset, setSmsToPreset] = useState("");
  const [smsBodyPreset, setSmsBodyPreset] = useState("");
  const [smsMessages, setSmsMessages] = useState<VoicemailMessage[]>([]);

  // sipRequest configuration state
  const [srName, setSrName] = useState("sip_request_tool");
  const [srDescription, setSrDescription] = useState(
    "Send a SIP INFO/MESSAGE/NOTIFY request with optional headers and body.",
  );
  const [srAsync, setSrAsync] = useState(false);
  const [srStrict, setSrStrict] = useState(false);
  const [srParamsMode, setSrParamsMode] = useState<"visual" | "json">("visual");
  const [srParamsJson, setSrParamsJson] = useState("{\n  \"type\": \"object\",\n  \"properties\": {},\n  \"required\": []\n}");
  const [srParamsLocked, setSrParamsLocked] = useState(false);
  const [srSipVerb, setSrSipVerb] = useState<"INFO" | "MESSAGE" | "NOTIFY">("INFO");
  const [srHeadersLocked, setSrHeadersLocked] = useState(false);
  const [srBodyMode, setSrBodyMode] = useState<"schema" | "raw">("schema");
  const [srBodyRaw, setSrBodyRaw] = useState("");
  const [srBodyLocked, setSrBodyLocked] = useState(false);
  const [srMessages, setSrMessages] = useState<VoicemailMessage[]>([]);

  // handoff configuration state
  const [hoName, setHoName] = useState("handoff_tool");
  const [hoDescription, setHoDescription] = useState("");
  const [hoAsync, setHoAsync] = useState(false);
  const [hoStrict, setHoStrict] = useState(false);
  const [hoParamsMode, setHoParamsMode] = useState<"visual" | "json">("visual");
  const [hoParamsJson, setHoParamsJson] = useState("{\n  \"type\": \"object\",\n  \"properties\": {},\n  \"required\": []\n}");
  const [hoParamsLocked, setHoParamsLocked] = useState(false);
  const [hoDestinations, setHoDestinations] = useState<Array<{ assistantId: string; description: string }>>([]);
  const [hoMessages, setHoMessages] = useState<VoicemailMessage[]>([]);
  const [hoAssistantOptions, setHoAssistantOptions] = useState<Array<{ id: string; name: string | null }>>([]);
  const loadAssistants = useServerFn(listVapiAssistants);
  useEffect(() => {
    let mounted = true;
    loadAssistants()
      .then((rows) => {
        if (!mounted) return;
        setHoAssistantOptions(rows.filter((r) => r.id !== id).map((r) => ({ id: r.id, name: r.name ?? null })));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [id, loadAssistants]);

  // query configuration state
  const [qName, setQName] = useState("query_tool");
  const [qDescription, setQDescription] = useState("");
  const [qKnowledgeBases, setQKnowledgeBases] = useState<Array<{ fileId: string }>>([]);
  const [qMessages, setQMessages] = useState<VoicemailMessage[]>([]);

  // apiRequest configuration state
  const [arName, setArName] = useState("");
  const [arDescription, setArDescription] = useState("");
  const [arUrl, setArUrl] = useState("");
  const [arMethod, setArMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("GET");
  const [arHeaders, setArHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [arBodyLocked, setArBodyLocked] = useState(false);
  const [arStaticFields, setArStaticFields] = useState<Array<{ key: string; value: string }>>([]);
  const [arMessages, setArMessages] = useState<VoicemailMessage[]>([]);

  // mcp configuration state
  const [mcpName, setMcpName] = useState("mcp_tool");
  const [mcpDescription, setMcpDescription] = useState("");
  const [mcpServerUrl, setMcpServerUrl] = useState("");
  const [mcpTimeout, setMcpTimeout] = useState(20);
  const [mcpAuth, setMcpAuth] = useState("none");
  const [mcpHeaders, setMcpHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [mcpStaticIp, setMcpStaticIp] = useState(false);
  const [mcpEncryptedPaths, setMcpEncryptedPaths] = useState<string[]>([]);
  const [mcpProtocol, setMcpProtocol] = useState<"shttp" | "sse">("shttp");
  const [mcpMessages, setMcpMessages] = useState<VoicemailMessage[]>([]);

  // slack configuration state
  const [slName, setSlName] = useState("slack_send_message_tool");
  const [slDescription, setSlDescription] = useState("");
  const [slMessages, setSlMessages] = useState<VoicemailMessage[]>([]);



  function resetForm() {
    setTransferNumber("");
    setFnName("");
    setFnDescription("");
    setServerUrl("");
    setFnParams(DEFAULT_FN_PARAMS);
    setTcName("transferCall");
    setTcDescription("");
    setTcDestinations([]);
    setTcMessages([]);
    setEcName("endCall");
    setEcDescription("");
    setEcMessages([]);
    setVmName("voicemail_tool");
    setVmDescription("");
    setVmScriptMode("assistant");
    setVmScriptContent("");
    setVmBeepDetection(false);
    setVmMessages([]);
    setDtName("dtmf_tool");
    setDtDescription("");
    setDtSipInfo(false);
    setDtMessages([]);
    setSmsName("send_text_tool");
    setSmsDescription("");
    setSmsToPreset("");
    setSmsBodyPreset("");
    setSmsMessages([]);
    setSrName("sip_request_tool");
    setSrDescription("Send a SIP INFO/MESSAGE/NOTIFY request with optional headers and body.");
    setSrAsync(false);
    setSrStrict(false);
    setSrParamsMode("visual");
    setSrParamsJson("{\n  \"type\": \"object\",\n  \"properties\": {},\n  \"required\": []\n}");
    setSrParamsLocked(false);
    setSrSipVerb("INFO");
    setSrHeadersLocked(false);
    setSrBodyMode("schema");
    setSrBodyRaw("");
    setSrBodyLocked(false);
    setSrMessages([]);
    setHoName("handoff_tool");
    setHoDescription("");
    setHoAsync(false);
    setHoStrict(false);
    setHoParamsMode("visual");
    setHoParamsJson("{\n  \"type\": \"object\",\n  \"properties\": {},\n  \"required\": []\n}");
    setHoParamsLocked(false);
    setHoDestinations([]);
    setHoMessages([]);
    setQName("query_tool");
    setQDescription("");
    setQKnowledgeBases([]);
    setQMessages([]);
    setArName("");
    setArDescription("");
    setArUrl("");
    setArMethod("GET");
    setArHeaders([]);
    setArBodyLocked(false);
    setArStaticFields([]);
    setArMessages([]);
    setMcpName("mcp_tool");
    setMcpDescription("");
    setMcpServerUrl("");
    setMcpTimeout(20);
    setMcpAuth("none");
    setMcpHeaders([]);
    setMcpStaticIp(false);
    setMcpEncryptedPaths([]);
    setMcpProtocol("shttp");
    setMcpMessages([]);
    setSlName("slack_send_message_tool");
    setSlDescription("");
    setSlMessages([]);
  }

  function openDialog() {
    resetForm();
    setSelected(null);
    setStep("select");
    setOpen(true);
  }

  function pickItem(item: CatalogItem) {
    setSelected(item);
    setStep("configure");
  }

  function backToSelect() {
    setStep("select");
    setSelected(null);
    resetForm();
  }

  function buildTool(): VapiTool | null {
    if (!selected) return null;
    if (selected.kind === "transferCall") {
      if (tcDestinations.length === 0) {
        toast.error("Adicione pelo menos um destino de transferência.");
        return null;
      }
      for (const d of tcDestinations) {
        if (d.type === "number" && !d.number.trim()) {
          toast.error("Preencha todos os números de destino.");
          return null;
        }
        if (d.type === "sip" && !d.sipUri.trim()) {
          toast.error("Preencha todas as URIs SIP.");
          return null;
        }
      }
      const name = tcName.trim() || "transferCall";
      const tool: VapiTool = {
        type: "transferCall",
        name,
        destinations: tcDestinations.map((d) =>
          d.type === "number"
            ? { type: "number", number: d.number.trim() }
            : { type: "sip", sipUri: d.sipUri.trim() },
        ),
      };
      if (tcDescription.trim()) tool.description = tcDescription.trim();
      if (tcMessages.length > 0) {
        tool.messages = tcMessages.map((m) => ({
          type: m.type,
          content: m.content,
        }));
      }
      return tool;
    }
    if (selected.kind === "dtmf") {
      const name = dtName.trim() || "dtmf_tool";
      const tool: VapiTool = { type: "dtmf", name };
      if (dtDescription.trim()) tool.description = dtDescription.trim();
      if (dtSipInfo) tool.sipInfoDtmfEnabled = true;
      if (dtMessages.length > 0) {
        tool.messages = dtMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "sms") {
      const name = smsName.trim() || "send_text_tool";
      const tool: VapiTool = { type: "sms", name };
      if (smsDescription.trim()) tool.description = smsDescription.trim();
      // Preset fields (dashboard-only helpers) are stashed on `metadata`.
      // Vapi rejects unknown top-level keys on built-in tools; metadata is
      // stripped in the sanitizer to match the API contract.
      const metadata: Record<string, string> = {};
      if (smsToPreset.trim()) metadata.toPreset = smsToPreset.trim();
      if (smsBodyPreset.trim()) metadata.bodyPreset = smsBodyPreset.trim();
      if (Object.keys(metadata).length > 0) tool.metadata = metadata;
      if (smsMessages.length > 0) {
        tool.messages = smsMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "endCall") {
      const name = ecName.trim() || "endCall";
      const tool: VapiTool = { type: "endCall", name };
      if (ecDescription.trim()) tool.description = ecDescription.trim();
      const messages = ecMessages
        .filter((m) => m.mode !== "default")
        .map((m) => {
          const msg: Record<string, unknown> = {
            type: m.type,
            content: m.mode === "custom" ? m.content : "",
          };
          if (m.blocking) msg.blocking = true;
          return msg;
        });
      if (messages.length > 0) tool.messages = messages;
      return tool;
    }
    if (selected.kind === "voicemail") {
      if (vmScriptMode === "custom" && !vmScriptContent.trim()) {
        toast.error('Escreva o script personalizado ou escolha outra opção em "What should the caller hear?".');
        return null;
      }
      const name = vmName.trim() || "voicemail_tool";
      const tool: VapiTool = { type: "voicemail", name };
      if (vmDescription.trim()) tool.description = vmDescription.trim();
      // Vapi tools accept a free-form `metadata` object; we use it to persist
      // dashboard-only preferences (script mode/content, beep detection)
      // that are not first-class fields on the voicemail tool schema.
      tool.metadata = {
        voicemailScriptMode: vmScriptMode,
        ...(vmScriptMode === "custom" ? { voicemailScript: vmScriptContent.trim() } : {}),
        beepDetectionEnabled: vmBeepDetection,
      };
      if (vmMessages.length > 0) {
        tool.messages = vmMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "sipRequest") {
      const name = srName.trim() || "sip_request_tool";
      let parameters: unknown = {};
      if (srParamsMode === "json") {
        try {
          parameters = JSON.parse(srParamsJson);
        } catch {
          toast.error("JSON Schema inválido no painel Parameters.");
          return null;
        }
      } else {
        parameters = {
          type: "object",
          properties: {},
          required: [],
          ...(srParamsLocked ? { additionalProperties: false } : {}),
        };
      }
      const headers: Record<string, unknown> = {
        type: "object",
        properties: {},
        required: [],
        ...(srHeadersLocked ? { additionalProperties: false } : {}),
      };
      let body: unknown;
      if (srBodyMode === "raw") {
        body = srBodyRaw;
      } else {
        body = {
          type: "object",
          properties: {},
          required: [],
          ...(srBodyLocked ? { additionalProperties: false } : {}),
        };
      }
      const tool: VapiTool = {
        type: "sipRequest",
        name,
        description: srDescription.trim(),
        async: srAsync,
        strict: srStrict,
        parameters,
        sipVerb: srSipVerb,
        headers,
        body,
      };
      if (srMessages.length > 0) {
        tool.messages = srMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "handoff") {
      if (hoDestinations.length === 0) {
        toast.error("Adicione pelo menos um destino de handoff.");
        return null;
      }
      for (const d of hoDestinations) {
        if (!d.assistantId.trim()) {
          toast.error("Selecione o assistente de destino em todos os destinos.");
          return null;
        }
      }
      let parameters: unknown = {};
      if (hoParamsMode === "json") {
        try {
          parameters = JSON.parse(hoParamsJson);
        } catch {
          toast.error("JSON Schema inválido no painel Parameters.");
          return null;
        }
      } else {
        parameters = {
          type: "object",
          properties: {},
          required: [],
          ...(hoParamsLocked ? { additionalProperties: false } : {}),
        };
      }
      const tool: VapiTool = {
        type: "handoff",
        name: hoName.trim() || "handoff_tool",
        description: hoDescription.trim(),
        async: hoAsync,
        strict: hoStrict,
        parameters,
        destinations: hoDestinations.map((d) => ({
          type: "assistant",
          assistantId: d.assistantId,
          ...(d.description.trim() ? { description: d.description.trim() } : {}),
        })),
      };
      if (hoMessages.length > 0) {
        tool.messages = hoMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "query") {
      if (qKnowledgeBases.length === 0) {
        toast.error("Adicione pelo menos uma base de conhecimento.");
        return null;
      }
      for (const kb of qKnowledgeBases) {
        if (!kb.fileId.trim()) {
          toast.error("Informe o ID de todas as bases de conhecimento.");
          return null;
        }
      }
      const name = qName.trim() || "query_tool";
      const tool: VapiTool = {
        type: "query",
        name,
        description: qDescription.trim(),
        knowledgeBases: qKnowledgeBases.map((kb, idx) => ({
          name: `kb-${idx + 1}`,
          provider: "google",
          description: qDescription.trim() || "Knowledge base",
          fileIds: [kb.fileId.trim()],
        })),
      };
      if (qMessages.length > 0) {
        tool.messages = qMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "apiRequest") {
      const name = arName.trim();
      if (!name) {
        toast.error("Nome da ferramenta é obrigatório.");
        return null;
      }
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(name)) {
        toast.error("Nome deve conter apenas letras, números, _ ou - (máx 40).");
        return null;
      }
      const url = arUrl.trim();
      if (!url.startsWith("https://")) {
        toast.error("A URL deve começar com https://.");
        return null;
      }
      const tool: VapiTool = {
        type: "apiRequest",
        name,
        method: arMethod,
        url,
      };
      if (arDescription.trim()) tool.description = arDescription.trim();
      if (arHeaders.length > 0) {
        const props: Record<string, unknown> = {};
        const required: string[] = [];
        for (const h of arHeaders) {
          const k = h.key.trim();
          if (!k) continue;
          props[k] = { type: "string", ...(h.value.trim() ? { default: h.value.trim() } : {}) };
          required.push(k);
        }
        if (Object.keys(props).length > 0) {
          tool.headers = { type: "object", properties: props, required };
        }
      }
      if (arStaticFields.length > 0) {
        const props: Record<string, unknown> = {};
        for (const f of arStaticFields) {
          const k = f.key.trim();
          if (!k) continue;
          props[k] = { type: "string", ...(f.value.trim() ? { default: f.value.trim() } : {}) };
        }
        if (Object.keys(props).length > 0) {
          tool.body = {
            type: "object",
            properties: props,
            required: Object.keys(props),
            ...(arBodyLocked ? { additionalProperties: false } : {}),
          };
        }
      }
      if (arMessages.length > 0) {
        tool.messages = arMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "mcp") {
      const url = mcpServerUrl.trim();
      if (!url) {
        toast.error("Informe a Server URL do MCP.");
        return null;
      }
      if (!/^https?:\/\//.test(url)) {
        toast.error("A Server URL deve começar com http(s)://");
        return null;
      }
      const name = mcpName.trim() || "mcp_tool";
      const tool: VapiTool = {
        type: "mcp",
        name,
        server: {
          url,
          timeoutSeconds: mcpTimeout,
        },
        protocol: mcpProtocol,
      };
      if (mcpDescription.trim()) tool.description = mcpDescription.trim();
      if (mcpHeaders.length > 0) {
        const headers: Record<string, string> = {};
        for (const h of mcpHeaders) {
          const k = h.key.trim();
          if (k) headers[k] = h.value;
        }
        if (Object.keys(headers).length > 0) {
          (tool.server as Record<string, unknown>).headers = headers;
        }
      }
      if (mcpMessages.length > 0) {
        tool.messages = mcpMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "slack") {
      const name = slName.trim() || "slack_send_message_tool";
      const tool: VapiTool = {
        type: "slack.message.send",
        name,
      };
      if (slDescription.trim()) tool.description = slDescription.trim();
      if (slMessages.length > 0) {
        tool.messages = slMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "function") {
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
    return null;
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
      backToSelect();
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
          onClick={openDialog}
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
          const meta = toolCardMeta(tool);
          const Icon = meta.icon;
          return (
            <Card
              key={index}
              className="group relative overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
            >
              <CardContent className="relative space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-xl backdrop-blur-xl",
                      meta.iconBg,
                      meta.iconColor,
                    )}
                  >
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
        <DialogContent className="max-w-2xl border-white/[0.08] bg-card/90 p-0 backdrop-blur-2xl">
          {step === "select" ? (
            <div className="flex max-h-[80vh] flex-col">
              <DialogHeader className="border-b border-white/[0.06] px-6 py-4">
                <DialogTitle>Adicionar Ferramenta</DialogTitle>
                <DialogDescription>
                  Escolha o tipo de ferramenta que o assistente poderá usar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 overflow-y-auto px-6 py-5">
                {TOOL_CATALOG.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                      {section.title}
                    </p>
                    <div className="space-y-1.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => pickItem(item)}
                            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-background/30 p-3 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-background/50"
                          >
                            <div
                              className={cn(
                                "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                                item.iconBg,
                                item.iconColor,
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {item.label}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                            {item.kind === "comingSoon" && (
                              <span className="rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                Em breve
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-white/[0.06] px-6 py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={backToSelect}
                  className="mb-2 -ml-2 h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </Button>
                <div className="flex items-center gap-3">
                  {selected && (
                    <div
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-lg",
                        selected.iconBg,
                        selected.iconColor,
                      )}
                    >
                      <selected.icon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <DialogTitle className="text-base">
                      {selected?.label ?? "Configurar Ferramenta"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {selected?.description}
                    </DialogDescription>
                  </div>
                </div>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                {selected?.kind === "transferCall" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tc-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="tc-name"
                          value={tcName}
                          onChange={(e) => setTcName(e.target.value)}
                          placeholder="transfer_call_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Padrão da Vapi é <span className="font-mono">transferCall</span>. Edite se necessário.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tc-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="tc-desc"
                          rows={3}
                          maxLength={1000}
                          value={tcDescription}
                          onChange={(e) => setTcDescription(e.target.value)}
                          placeholder="Explique para a IA quando usar essa ferramenta."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {tcDescription.length}/1000
                        </p>
                      </div>
                    </div>

                    {/* Panel 2 — Destinations */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Destinations
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Destination
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            <DropdownMenuItem
                              onClick={() =>
                                setTcDestinations((p) => [...p, { type: "number", number: "" }])
                              }
                            >
                              <Phone className="mr-2 h-3.5 w-3.5" />
                              Phone Number
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setTcDestinations((p) => [...p, { type: "sip", sipUri: "" }])
                              }
                            >
                              <Radio className="mr-2 h-3.5 w-3.5" />
                              SIP
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {tcDestinations.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-6 text-center">
                          <PhoneOffIcon className="h-6 w-6 text-muted-foreground/60" />
                          <p className="text-xs text-muted-foreground">
                            No destinations configured. Click 'Add Destination' to add a transfer destination.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tcDestinations.map((d, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-background/40 p-2 backdrop-blur-xl"
                            >
                              <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {d.type === "number" ? "Phone" : "SIP"}
                              </span>
                              <Input
                                value={d.type === "number" ? d.number : d.sipUri}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTcDestinations((prev) =>
                                    prev.map((it, i) =>
                                      i !== idx
                                        ? it
                                        : it.type === "number"
                                          ? { ...it, number: val }
                                          : { ...it, sipUri: val },
                                    ),
                                  );
                                }}
                                placeholder={d.type === "number" ? "+5511999999999" : "sip:user@domain.com"}
                                className="h-8 border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setTcDestinations((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                aria-label="Remover destino"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Panel 3 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setTcMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {tcMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida. Adicione mensagens para o status da transferência.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {tcMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setTcMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTcMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                placeholder="Frase que a IA vai falar neste momento..."
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "dtmf" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dt-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="dt-name"
                          value={dtName}
                          onChange={(e) => setDtName(e.target.value)}
                          placeholder="dtmf_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dt-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="dt-desc"
                          rows={3}
                          maxLength={1000}
                          value={dtDescription}
                          onChange={(e) => setDtDescription(e.target.value)}
                          placeholder="Explique para a IA quando usar essa ferramenta."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {dtDescription.length}/1000
                        </p>
                      </div>
                    </div>

                    {/* SIP INFO Checkbox */}
                    <label
                      htmlFor="dt-sipinfo"
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl hover:bg-background/40"
                    >
                      <Checkbox
                        id="dt-sipinfo"
                        checked={dtSipInfo}
                        onCheckedChange={(v) => setDtSipInfo(v === true)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            Send DTMF via SIP INFO
                          </span>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Use SIP INFO messages for DTMF signaling instead of RFC 2833 (RTP events).
                        </p>
                      </div>
                    </label>

                    {/* Panel 2 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setDtMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {dtMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida. Adicione mensagens de status opcionais.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dtMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setDtMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDtMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                placeholder="Frase que a IA vai falar neste momento..."
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "endCall" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ec-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="ec-name"
                          value={ecName}
                          onChange={(e) => setEcName(e.target.value)}
                          placeholder="end_call_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ec-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="ec-desc"
                          rows={3}
                          maxLength={1000}
                          value={ecDescription}
                          onChange={(e) => setEcDescription(e.target.value)}
                          placeholder="Describe the tool in a few sentences"
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {ecDescription.length}/1000
                        </p>
                      </div>
                    </div>

                    {/* Panel 2 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {END_CALL_MESSAGE_TYPES.map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setEcMessages((p) => [
                                    ...p,
                                    { type: t, mode: "default", content: "", blocking: false },
                                  ])
                                }
                              >
                                {END_CALL_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {ecMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida. Adicione mensagens para os estágios da chamada.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {ecMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-3 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {END_CALL_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setEcMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  Message Option
                                </Label>
                                <RadioGroup
                                  value={m.mode}
                                  onValueChange={(v) =>
                                    setEcMessages((prev) =>
                                      prev.map((it, i) =>
                                        i === idx ? { ...it, mode: v as EndCallMessageMode } : it,
                                      ),
                                    )
                                  }
                                  className="space-y-1.5"
                                >
                                  <div className="flex items-start gap-2">
                                    <RadioGroupItem value="default" id={`ec-${idx}-default`} className="mt-0.5" />
                                    <Label htmlFor={`ec-${idx}-default`} className="cursor-pointer text-xs font-normal">
                                      Default
                                      <span className="ml-1 text-[10px] text-muted-foreground">
                                        (server will use default message)
                                      </span>
                                    </Label>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <RadioGroupItem value="none" id={`ec-${idx}-none`} className="mt-0.5" />
                                    <Label htmlFor={`ec-${idx}-none`} className="cursor-pointer text-xs font-normal">
                                      None
                                      <span className="ml-1 text-[10px] text-muted-foreground">
                                        (no message will be spoken)
                                      </span>
                                    </Label>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <RadioGroupItem value="custom" id={`ec-${idx}-custom`} className="mt-0.5" />
                                    <Label htmlFor={`ec-${idx}-custom`} className="cursor-pointer text-xs font-normal">
                                      Custom
                                    </Label>
                                  </div>
                                </RadioGroup>

                                {m.mode === "custom" && (
                                  <div className="space-y-2 pl-6">
                                    <Textarea
                                      rows={2}
                                      value={m.content}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEcMessages((prev) =>
                                          prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                        );
                                      }}
                                      placeholder="Frase que a IA vai falar..."
                                      className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled
                                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground/60"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add variant
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-start gap-2 rounded border border-white/[0.04] bg-background/30 p-2">
                                <Checkbox
                                  id={`ec-${idx}-blocking`}
                                  checked={m.blocking}
                                  onCheckedChange={(v) =>
                                    setEcMessages((prev) =>
                                      prev.map((it, i) =>
                                        i === idx ? { ...it, blocking: v === true } : it,
                                      ),
                                    )
                                  }
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`ec-${idx}-blocking`}
                                  className="cursor-pointer text-[11px] font-normal leading-snug text-muted-foreground"
                                >
                                  Wait for selected message to be spoken before triggering tool call
                                </Label>
                              </div>

                              <Collapsible>
                                <div className="flex items-center justify-between">
                                  <CollapsibleTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                      Conditions
                                    </button>
                                  </CollapsibleTrigger>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled
                                    className="h-6 gap-1 px-2 text-[11px] text-muted-foreground/60"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Add
                                  </Button>
                                </div>
                                <CollapsibleContent className="pt-2">
                                  <p className="rounded border border-dashed border-white/[0.06] bg-background/20 p-2 text-[11px] text-muted-foreground">
                                    Configuração de condições em breve.
                                  </p>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "voicemail" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vm-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="vm-name"
                          value={vmName}
                          onChange={(e) => setVmName(e.target.value)}
                          placeholder="voicemail_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vm-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="vm-desc"
                          rows={3}
                          maxLength={1000}
                          value={vmDescription}
                          onChange={(e) => setVmDescription(e.target.value)}
                          placeholder="Leave a voicemail message when you determine the call reached voicemail."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {vmDescription.length}/1000
                        </p>
                      </div>
                    </div>

                    {/* Panel 2 — Voicemail Script */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Voicemail className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Voicemail Script
                        </h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        When the LLM determines it has reached voicemail, it will call this tool and speak the script below before the call worker ends the call.
                      </p>
                      <Label className="text-xs">What should the caller hear?</Label>
                      <RadioGroup
                        value={vmScriptMode}
                        onValueChange={(v) => setVmScriptMode(v as VoicemailScriptMode)}
                        className="grid gap-2"
                      >
                        {([
                          { value: "assistant", title: "Use assistant voicemail message", subtitle: "Falls back to the assistant's 'voicemailMessage' setting." },
                          { value: "custom", title: "Use custom script", subtitle: "Provide a message for the assistant to speak once it confirms a voicemail greeting." },
                          { value: "skip", title: "Skip speaking a voicemail", subtitle: "The assistant will silently end the call after invoking the tool." },
                        ] as const).map((opt) => (
                          <label
                            key={opt.value}
                            htmlFor={`vm-mode-${opt.value}`}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.08] bg-background/40 p-3 backdrop-blur-xl transition-colors hover:bg-background/60",
                              vmScriptMode === opt.value && "border-primary/60 bg-primary/[0.06]",
                            )}
                          >
                            <RadioGroupItem id={`vm-mode-${opt.value}`} value={opt.value} className="mt-0.5" />
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-foreground">{opt.title}</p>
                              <p className="text-[11px] text-muted-foreground">{opt.subtitle}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>

                      {vmScriptMode === "custom" && (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="vm-script" className="text-xs">Script content</Label>
                          <Textarea
                            id="vm-script"
                            rows={4}
                            value={vmScriptContent}
                            onChange={(e) => setVmScriptContent(e.target.value)}
                            placeholder="Hi, this is {{company}}. {{message}}. Please call us back at {{phone}}."
                            className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                          />
                        </div>
                      )}
                    </div>

                    {/* Panel 3 — Beep Detection */}
                    <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-background/30 px-4 py-3 backdrop-blur-xl">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Enable beep detection</p>
                        <p className="text-[11px] text-muted-foreground">
                          Espera o bipe da caixa postal antes de iniciar a mensagem.
                        </p>
                      </div>
                      <Switch checked={vmBeepDetection} onCheckedChange={setVmBeepDetection} />
                    </div>

                    {/* Panel 4 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setVmMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {vmMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida. Adicione mensagens de status opcionais.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {vmMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setVmMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setVmMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                placeholder="Frase que a IA vai falar neste momento..."
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "sms" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sms-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="sms-name"
                          value={smsName}
                          onChange={(e) => setSmsName(e.target.value)}
                          placeholder="send_text_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sms-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="sms-desc"
                          rows={3}
                          maxLength={1000}
                          value={smsDescription}
                          onChange={(e) => setSmsDescription(e.target.value)}
                          placeholder="Explique para a IA quando enviar SMS."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {smsDescription.length}/1000
                        </p>
                      </div>
                    </div>

                    {/* Panel 2 — SMS Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          SMS Settings
                        </h3>
                      </div>

                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <p className="text-[11px] leading-relaxed text-amber-200/90">
                          No configured Twilio numbers found. Add one in{" "}
                          <span className="font-semibold underline underline-offset-2">Phone Numbers</span>.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">From Phone Number *</Label>
                        <Select disabled>
                          <SelectTrigger className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                            <SelectValue placeholder="Selecione um número Twilio" />
                          </SelectTrigger>
                          <SelectContent />
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sms-to" className="text-xs">To Phone Number (Preset)</Label>
                        <Input
                          id="sms-to"
                          value={smsToPreset}
                          onChange={(e) => setSmsToPreset(e.target.value)}
                          placeholder="{{customer.number}}"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Optional preset recipient phone number. Supports LiquidJS templates (e.g., {"{{customer.number}}"}). When set, this overrides any model-provided value.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sms-body" className="text-xs">Message Body (Preset)</Label>
                        <Textarea
                          id="sms-body"
                          rows={3}
                          value={smsBodyPreset}
                          onChange={(e) => setSmsBodyPreset(e.target.value)}
                          placeholder="Seu horário está confirmado para {{appointmentDate}}."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Optional preset message body. Supports LiquidJS templates (e.g., {"{{appointmentDate}}"}). When set, this overrides any model-provided value.
                        </p>
                      </div>
                    </div>

                    {/* Panel 3 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setSmsMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {smsMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {smsMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setSmsMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSmsMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                placeholder="Frase que a IA vai falar neste momento..."
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "sipRequest" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings & Options */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sr-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="sr-name"
                          value={srName}
                          onChange={(e) => setSrName(e.target.value)}
                          placeholder="sip_request_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sr-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="sr-desc"
                          rows={3}
                          value={srDescription}
                          onChange={(e) => setSrDescription(e.target.value)}
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                      </div>

                      <div className="space-y-3 border-t border-white/[0.06] pt-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-foreground">Async</p>
                            <p className="text-[11px] text-muted-foreground">Tool executes asynchronously</p>
                          </div>
                          <Switch checked={srAsync} onCheckedChange={setSrAsync} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-foreground">Strict</p>
                            <p className="text-[11px] text-muted-foreground">
                              Enforces strict parameter validation. Requires all properties to be marked as required and schema locked.
                            </p>
                          </div>
                          <Switch checked={srStrict} onCheckedChange={setSrStrict} />
                        </div>
                      </div>
                    </div>

                    {/* Panel 2 — Parameters */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Parameters
                          </h3>
                        </div>
                        <div className="flex overflow-hidden rounded-md border border-white/[0.08]">
                          <button
                            type="button"
                            onClick={() => setSrParamsMode("visual")}
                            className={cn(
                              "px-3 py-1 text-[11px]",
                              srParamsMode === "visual" ? "bg-white/10 text-foreground" : "text-muted-foreground",
                            )}
                          >
                            Visual
                          </button>
                          <button
                            type="button"
                            onClick={() => setSrParamsMode("json")}
                            className={cn(
                              "px-3 py-1 text-[11px]",
                              srParamsMode === "json" ? "bg-white/10 text-foreground" : "text-muted-foreground",
                            )}
                          >
                            JSON
                          </button>
                        </div>
                      </div>
                      {srParamsMode === "visual" ? (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/40 p-6 text-center">
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                              <Plus className="h-3 w-3" />
                              Add Property
                            </Button>
                            <p className="mt-3 text-[11px] text-muted-foreground">No parameters defined</p>
                          </div>
                          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Checkbox
                              checked={srParamsLocked}
                              onCheckedChange={(v) => setSrParamsLocked(v === true)}
                            />
                            Lock schema (no additional properties)
                          </label>
                        </div>
                      ) : (
                        <Textarea
                          rows={10}
                          value={srParamsJson}
                          onChange={(e) => setSrParamsJson(e.target.value)}
                          spellCheck={false}
                          className="border-white/[0.08] bg-background/40 font-mono text-[11px] backdrop-blur-xl"
                        />
                      )}
                    </div>

                    {/* Panel 3 — SIP Settings */}
                    <div className="space-y-4 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          SIP Settings
                        </h3>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">SIP verb</Label>
                        <Select value={srSipVerb} onValueChange={(v) => setSrSipVerb(v as typeof srSipVerb)}>
                          <SelectTrigger className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INFO">INFO</SelectItem>
                            <SelectItem value="MESSAGE">MESSAGE</SelectItem>
                            <SelectItem value="NOTIFY">NOTIFY</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 border-t border-white/[0.06] pt-3">
                        <p className="text-xs font-semibold text-foreground">Headers</p>
                        <p className="text-[11px] text-muted-foreground">
                          Define SIP headers to include in the request.
                        </p>
                        <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/40 p-6 text-center">
                          <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                            <Plus className="h-3 w-3" />
                            Add Property
                          </Button>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Checkbox
                            checked={srHeadersLocked}
                            onCheckedChange={(v) => setSrHeadersLocked(v === true)}
                          />
                          Lock schema (no additional properties)
                        </label>
                      </div>

                      <div className="space-y-2 border-t border-white/[0.06] pt-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-foreground">Body</p>
                            <p className="text-[11px] text-muted-foreground">
                              Use a raw string body, or define a JSON schema.
                            </p>
                          </div>
                          <Select value={srBodyMode} onValueChange={(v) => setSrBodyMode(v as "schema" | "raw")}>
                            <SelectTrigger className="h-7 w-[150px] border-white/[0.08] bg-background/40 text-[11px] backdrop-blur-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="schema">Schema builder</SelectItem>
                              <SelectItem value="raw">Raw string</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {srBodyMode === "schema" ? (
                          <>
                            <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/40 p-6 text-center">
                              <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                                <Plus className="h-3 w-3" />
                                Add Property
                              </Button>
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Checkbox
                                checked={srBodyLocked}
                                onCheckedChange={(v) => setSrBodyLocked(v === true)}
                              />
                              Lock schema (no additional properties)
                            </label>
                          </>
                        ) : (
                          <Textarea
                            rows={5}
                            value={srBodyRaw}
                            onChange={(e) => setSrBodyRaw(e.target.value)}
                            placeholder="Raw body payload"
                            className="border-white/[0.08] bg-background/40 font-mono text-[11px] backdrop-blur-xl"
                          />
                        )}
                      </div>
                    </div>

                    {/* Panel 4 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setSrMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {srMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {srMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setSrMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSrMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "handoff" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings & Options */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ho-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="ho-name"
                          value={hoName}
                          onChange={(e) => setHoName(e.target.value)}
                          placeholder="handoff_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ho-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="ho-desc"
                          rows={3}
                          maxLength={1000}
                          value={hoDescription}
                          onChange={(e) => setHoDescription(e.target.value)}
                          placeholder="Explique quando a IA deve transferir para outro assistente."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {hoDescription.length}/1000
                        </p>
                      </div>
                      <div className="space-y-3 border-t border-white/[0.06] pt-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-foreground">Async</p>
                            <p className="text-[11px] text-muted-foreground">Tool executes asynchronously</p>
                          </div>
                          <Switch checked={hoAsync} onCheckedChange={setHoAsync} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-foreground">Strict</p>
                            <p className="text-[11px] text-muted-foreground">
                              Enforces strict parameter validation. Requires all properties to be marked as required and schema locked.
                            </p>
                          </div>
                          <Switch checked={hoStrict} onCheckedChange={setHoStrict} />
                        </div>
                      </div>
                    </div>

                    {/* Panel 2 — Parameters */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Parameters
                          </h3>
                        </div>
                        <div className="flex overflow-hidden rounded-md border border-white/[0.08]">
                          <button
                            type="button"
                            onClick={() => setHoParamsMode("visual")}
                            className={cn(
                              "px-3 py-1 text-[11px]",
                              hoParamsMode === "visual" ? "bg-white/10 text-foreground" : "text-muted-foreground",
                            )}
                          >
                            Visual
                          </button>
                          <button
                            type="button"
                            onClick={() => setHoParamsMode("json")}
                            className={cn(
                              "px-3 py-1 text-[11px]",
                              hoParamsMode === "json" ? "bg-white/10 text-foreground" : "text-muted-foreground",
                            )}
                          >
                            JSON
                          </button>
                        </div>
                      </div>
                      {hoParamsMode === "visual" ? (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/40 p-6 text-center">
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                              <Plus className="h-3 w-3" />
                              Add Property
                            </Button>
                            <p className="mt-3 text-[11px] text-muted-foreground">No parameters defined</p>
                          </div>
                          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Checkbox
                              checked={hoParamsLocked}
                              onCheckedChange={(v) => setHoParamsLocked(v === true)}
                            />
                            Lock schema (no additional properties)
                          </label>
                        </div>
                      ) : (
                        <Textarea
                          rows={10}
                          value={hoParamsJson}
                          onChange={(e) => setHoParamsJson(e.target.value)}
                          spellCheck={false}
                          className="border-white/[0.08] bg-background/40 font-mono text-[11px] backdrop-blur-xl"
                        />
                      )}
                    </div>

                    {/* Panel 3 — Handoff Destinations */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <Shuffle className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Handoff Destinations
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                              Configure assistant destinations for handoffs
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setHoDestinations((p) => [...p, { assistantId: "", description: "" }])
                          }
                          className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        >
                          <Plus className="h-3 w-3" />
                          Add Destination
                        </Button>
                      </div>

                      {hoDestinations.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          No destinations configured. Click &apos;Add Destination&apos; to add your first destination.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {hoDestinations.map((d, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Select
                                    value={d.assistantId}
                                    onValueChange={(v) =>
                                      setHoDestinations((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, assistantId: v } : it)),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                      <SelectValue placeholder="Selecione um assistente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {hoAssistantOptions.length === 0 ? (
                                        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                                          Nenhum outro assistente disponível
                                        </div>
                                      ) : (
                                        hoAssistantOptions.map((a) => (
                                          <SelectItem key={a.id} value={a.id}>
                                            {a.name || a.id.slice(0, 8)}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setHoDestinations((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover destino"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                value={d.description}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setHoDestinations((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, description: val } : it)),
                                  );
                                }}
                                placeholder="Descrição (quando transferir para este assistente)"
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Panel 4 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setHoMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {hoMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {hoMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setHoMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setHoMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "query" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Tool Settings
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="q-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="q-name"
                          value={qName}
                          onChange={(e) => setQName(e.target.value)}
                          placeholder="query_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="q-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="q-desc"
                          rows={3}
                          maxLength={1000}
                          value={qDescription}
                          onChange={(e) => setQDescription(e.target.value)}
                          placeholder="Explique quando a IA deve consultar a base de conhecimento."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {qDescription.length}/1000
                        </p>
                      </div>
                    </div>

                    {/* Panel 2 — Knowledge Bases */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <ServerCog className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Knowledge Bases
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                              Configure knowledge bases for your query tool
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setQKnowledgeBases((p) => [...p, { fileId: "" }])
                          }
                          className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        >
                          <Plus className="h-3 w-3" />
                          Add Knowledge Base
                        </Button>
                      </div>

                      {qKnowledgeBases.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-8 text-center">
                          <ServerCog className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                          <p className="text-xs font-medium text-foreground">No knowledge bases configured</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Click &apos;Add Knowledge Base&apos; to add one
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {qKnowledgeBases.map((kb, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <Input
                                value={kb.fileId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQKnowledgeBases((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, fileId: val } : it)),
                                  );
                                }}
                                placeholder="ID do documento / File ID"
                                className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setQKnowledgeBases((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label="Remover base de conhecimento"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Panel 3 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Messages
                          </h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" />
                              Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() =>
                                  setQMessages((p) => [...p, { type: t, content: "" }])
                                }
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {qMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {qMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setQMessages((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQMessages((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, content: val } : it)),
                                  );
                                }}
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selected?.kind === "apiRequest" && (
                  <div className="space-y-4">
                    {/* Section 1 — Base Configuration (always visible) */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Base Configuration
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ar-name" className="text-xs">Tool Name *</Label>
                        <Input
                          id="ar-name"
                          value={arName}
                          onChange={(e) => setArName(e.target.value.replace(/\s+/g, ""))}
                          placeholder="e.g., getUserData, sendNotification"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ar-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="ar-desc"
                          rows={3}
                          maxLength={1000}
                          value={arDescription}
                          onChange={(e) => setArDescription(e.target.value)}
                          placeholder="Explique quando a IA deve chamar essa API."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ar-url" className="text-xs">Request URL *</Label>
                        <Input
                          id="ar-url"
                          value={arUrl}
                          onChange={(e) => setArUrl(e.target.value)}
                          placeholder="https://www.vapi.ai"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          The endpoint URL where the API request will be sent. Must use HTTPS.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Request HTTP Method *</Label>
                        <Select value={arMethod} onValueChange={(v) => setArMethod(v as typeof arMethod)}>
                          <SelectTrigger className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Sections 2-8 — Collapsible */}
                    <Accordion type="multiple" className="space-y-3">
                      <AccordionItem value="auth" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Authorization &amp; Headers
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pb-4">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">Authorization</p>
                            <p className="text-[11px] text-muted-foreground">Configure authentication for API requests</p>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                              <Plus className="h-3 w-3" />
                              Add Auth
                            </Button>
                          </div>
                          <div className="space-y-2 border-t border-white/[0.06] pt-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground">Request Headers</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setArHeaders((p) => [...p, { key: "", value: "" }])}
                                className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs"
                              >
                                <Plus className="h-3 w-3" />
                                Add Header
                              </Button>
                            </div>
                            {arHeaders.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-[11px] text-muted-foreground">
                                No headers configured.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {arHeaders.map((h, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <Input
                                      value={h.key}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setArHeaders((prev) => prev.map((it, i) => i === idx ? { ...it, key: val } : it));
                                      }}
                                      placeholder="Header name"
                                      className="border-white/[0.08] bg-background/40 font-mono text-xs"
                                    />
                                    <Input
                                      value={h.value}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setArHeaders((prev) => prev.map((it, i) => i === idx ? { ...it, value: val } : it));
                                      }}
                                      placeholder="Value"
                                      className="border-white/[0.08] bg-background/40 font-mono text-xs"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setArHeaders((prev) => prev.filter((_, i) => i !== idx))}
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      aria-label="Remover header"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="body" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Request Body
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/40 p-6 text-center">
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                              <Plus className="h-3 w-3" />
                              Add Property
                            </Button>
                            <p className="mt-3 text-[11px] text-muted-foreground">No parameters defined</p>
                          </div>
                          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Checkbox checked={arBodyLocked} onCheckedChange={(v) => setArBodyLocked(v === true)} />
                            Lock schema (no additional properties)
                          </label>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="static" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Static Body Fields
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[11px] text-muted-foreground">
                              Key-value pairs always sent in the request body. Values support Liquid templates.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setArStaticFields((p) => [...p, { key: "", value: "" }])}
                              className="h-7 shrink-0 gap-1 border-white/[0.08] bg-background/40 text-xs"
                            >
                              <Plus className="h-3 w-3" />
                              Add Field
                            </Button>
                          </div>
                          {arStaticFields.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-[11px] text-muted-foreground">
                              No static body fields configured. Click &apos;Add Field&apos; to add one.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {arStaticFields.map((f, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    value={f.key}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setArStaticFields((prev) => prev.map((it, i) => i === idx ? { ...it, key: val } : it));
                                    }}
                                    placeholder="Field name"
                                    className="border-white/[0.08] bg-background/40 font-mono text-xs"
                                  />
                                  <Input
                                    value={f.value}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setArStaticFields((prev) => prev.map((it, i) => i === idx ? { ...it, value: val } : it));
                                    }}
                                    placeholder="Value (supports {{liquid}})"
                                    className="border-white/[0.08] bg-background/40 font-mono text-xs"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setArStaticFields((prev) => prev.filter((_, i) => i !== idx))}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    aria-label="Remover campo"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="encryption" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Encryption Settings
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 pb-4">
                          <p className="text-[11px] text-muted-foreground">
                            Configure which request body fields should be encrypted.
                          </p>
                          <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-[11px] text-muted-foreground">
                            No encrypted fields configured.
                          </p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="response" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Response Body
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <p className="text-[11px] text-muted-foreground">
                            Assign dynamic variables extracted from the API response data.
                          </p>
                          <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                            <table className="w-full text-[11px]">
                              <thead className="bg-background/40">
                                <tr className="text-left text-muted-foreground">
                                  <th className="px-3 py-2 font-medium">Variable</th>
                                  <th className="px-3 py-2 font-medium">Type</th>
                                  <th className="px-3 py-2 font-medium">Required</th>
                                  <th className="px-3 py-2 font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                                    No response variables defined.
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                            <Plus className="h-3 w-3" />
                            Add Property
                          </Button>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="aliases" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Aliases
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <p className="text-[11px] text-muted-foreground">
                            Define aliases for response fields to expose simpler variable names to the model.
                          </p>
                          <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-[11px] text-muted-foreground">
                            No aliases configured. Click &apos;Add Alias&apos; to add one.
                          </p>
                          <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                            <Plus className="h-3 w-3" />
                            Add Alias
                          </Button>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="messages" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Messages
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs">
                                  <Plus className="h-3 w-3" />
                                  Add Message
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                                {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                                  <DropdownMenuItem
                                    key={t}
                                    onClick={() => setArMessages((p) => [...p, { type: t, content: "" }])}
                                  >
                                    {TRANSFER_MESSAGE_LABELS[t]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {arMessages.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                              Nenhuma mensagem definida.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {arMessages.map((m, idx) => (
                                <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-foreground">
                                      {TRANSFER_MESSAGE_LABELS[m.type]}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setArMessages((prev) => prev.filter((_, i) => i !== idx))}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      aria-label="Remover mensagem"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Textarea
                                    rows={2}
                                    value={m.content}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setArMessages((prev) => prev.map((it, i) => i === idx ? { ...it, content: val } : it));
                                    }}
                                    className="border-white/[0.08] bg-background/40 text-xs"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}

                {selected?.kind === "mcp" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Tool Settings</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mcp-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="mcp-name"
                          value={mcpName}
                          onChange={(e) => setMcpName(e.target.value)}
                          placeholder="mcp_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mcp-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="mcp-desc"
                          rows={3}
                          maxLength={1000}
                          value={mcpDescription}
                          onChange={(e) => setMcpDescription(e.target.value)}
                          placeholder="Explique quando a IA deve chamar este servidor MCP."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">{mcpDescription.length}/1000</p>
                      </div>
                    </div>

                    {/* Panel 2 — Server Settings */}
                    <Accordion type="single" collapsible defaultValue="server" className="rounded-xl border border-white/[0.08] bg-background/30 backdrop-blur-xl">
                      <AccordionItem value="server" className="border-0">
                        <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wide hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            Server Settings
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-4 pb-4">
                          <div className="space-y-2">
                            <Label htmlFor="mcp-url" className="text-xs">Server URL</Label>
                            <Input
                              id="mcp-url"
                              value={mcpServerUrl}
                              onChange={(e) => setMcpServerUrl(e.target.value)}
                              placeholder="https://api.example.com/function"
                              className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-xs">Timeout</Label>
                                <p className="text-[11px] text-muted-foreground">Server request timeout in seconds.</p>
                              </div>
                              <span className="rounded-md border border-white/[0.08] bg-background/40 px-2 py-0.5 font-mono text-[11px] text-foreground">
                                {mcpTimeout} sec
                              </span>
                            </div>
                            <Slider
                              min={1}
                              max={300}
                              step={1}
                              value={[mcpTimeout]}
                              onValueChange={(v) => setMcpTimeout(v[0] ?? 20)}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Authorization</Label>
                              <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                <Plus className="h-3 w-3" /> Add New
                              </Button>
                            </div>
                            <Select value={mcpAuth} onValueChange={setMcpAuth}>
                              <SelectTrigger className="h-9 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                                <SelectItem value="none">No authentication</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-6 text-center">
                              <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                              <p className="text-xs font-medium text-foreground">No custom credentials available</p>
                              <Button size="sm" variant="outline" className="mt-3 h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                <Plus className="h-3 w-3" /> Create Credential
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">HTTP Headers</Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMcpHeaders((p) => [...p, { key: "", value: "" }])}
                                className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              >
                                <Plus className="h-3 w-3" /> Add Header
                              </Button>
                            </div>
                            {mcpHeaders.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-6 text-center">
                                <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                                <p className="text-xs font-medium text-foreground">No Headers Configured</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {mcpHeaders.map((h, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <Input
                                      value={h.key}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setMcpHeaders((p) => p.map((it, i) => (i === idx ? { ...it, key: val } : it)));
                                      }}
                                      placeholder="Header"
                                      className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                                    />
                                    <Input
                                      value={h.value}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setMcpHeaders((p) => p.map((it, i) => (i === idx ? { ...it, value: val } : it)));
                                      }}
                                      placeholder="Value"
                                      className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setMcpHeaders((p) => p.filter((_, i) => i !== idx))}
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      aria-label="Remover header"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-background/40 p-3">
                            <p className="text-[11px] text-muted-foreground">
                              Route webhook requests through static IPs to allow-list Vapi in your firewall.
                            </p>
                            <Switch checked={mcpStaticIp} onCheckedChange={setMcpStaticIp} />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                              <p className="text-[11px] text-sky-100/80">
                                Encrypted paths let you protect sensitive fields inside the request/response bodies.
                                Use dot notation (e.g. <span className="font-mono">body.customer.email</span>).
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Encrypted Paths</Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMcpEncryptedPaths((p) => [...p, ""])}
                                className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              >
                                <Plus className="h-3 w-3" /> Add Path
                              </Button>
                            </div>
                            {mcpEncryptedPaths.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-6 text-center">
                                <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                                <p className="text-xs font-medium text-foreground">No Encrypted Paths</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {mcpEncryptedPaths.map((p, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <Input
                                      value={p}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setMcpEncryptedPaths((prev) => prev.map((it, i) => (i === idx ? val : it)));
                                      }}
                                      placeholder="body.field.path"
                                      className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setMcpEncryptedPaths((prev) => prev.filter((_, i) => i !== idx))}
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      aria-label="Remover path"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Panel 3 — MCP Settings */}
                    <Accordion type="single" collapsible defaultValue="mcp" className="rounded-xl border border-white/[0.08] bg-background/30 backdrop-blur-xl">
                      <AccordionItem value="mcp" className="border-0">
                        <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wide hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                            MCP Settings
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 px-4 pb-4">
                          <Label className="text-xs">Protocol</Label>
                          <div className="grid gap-2 md:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setMcpProtocol("shttp")}
                              className={cn(
                                "rounded-lg border p-3 text-left transition-all",
                                mcpProtocol === "shttp"
                                  ? "border-emerald-500/60 bg-emerald-500/5"
                                  : "border-white/[0.06] bg-background/40 hover:border-white/[0.12]",
                              )}
                            >
                              <p className="text-xs font-semibold text-foreground">Streamable HTTP (SHTTP)</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Uses HTTP-based streaming for communication</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMcpProtocol("sse")}
                              className={cn(
                                "rounded-lg border p-3 text-left transition-all",
                                mcpProtocol === "sse"
                                  ? "border-emerald-500/60 bg-emerald-500/5"
                                  : "border-white/[0.06] bg-background/40 hover:border-white/[0.12]",
                              )}
                            >
                              <p className="text-xs font-semibold text-foreground">Server-Sent Events (SSE)</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Uses event-driven communication</p>
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Choose the communication protocol for MCP server connections. Streamable HTTP (SHTTP) is recommended for most use cases.
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {/* Panel 4 — Messages */}
                    <Accordion type="single" collapsible className="rounded-xl border border-white/[0.08] bg-background/30 backdrop-blur-xl">
                      <AccordionItem value="msgs" className="border-0">
                        <AccordionTrigger className="px-4 py-3 text-xs font-semibold uppercase tracking-wide hover:no-underline">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            Messages
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 px-4 pb-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                <Plus className="h-3 w-3" /> Add Message
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                              {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                                <DropdownMenuItem
                                  key={t}
                                  onClick={() => setMcpMessages((p) => [...p, { type: t, content: "" }])}
                                >
                                  {TRANSFER_MESSAGE_LABELS[t]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {mcpMessages.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                              Nenhuma mensagem definida.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {mcpMessages.map((m, idx) => (
                                <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-foreground">
                                      {TRANSFER_MESSAGE_LABELS[m.type]}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setMcpMessages((prev) => prev.filter((_, i) => i !== idx))}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      aria-label="Remover mensagem"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Textarea
                                    rows={2}
                                    value={m.content}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setMcpMessages((prev) => prev.map((it, i) => (i === idx ? { ...it, content: val } : it)));
                                    }}
                                    className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}

                {selected?.kind === "slack" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Tool Settings</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sl-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="sl-name"
                          value={slName}
                          onChange={(e) => setSlName(e.target.value)}
                          placeholder="slack_send_message_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sl-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="sl-desc"
                          rows={3}
                          maxLength={1000}
                          value={slDescription}
                          onChange={(e) => setSlDescription(e.target.value)}
                          placeholder="Explique quando a IA deve enviar mensagens no Slack."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">{slDescription.length}/1000</p>
                      </div>
                    </div>

                    {/* Panel 2 — Messages */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Messages</h3>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                              <Plus className="h-3 w-3" /> Add Message
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                            {(Object.keys(TRANSFER_MESSAGE_LABELS) as TransferMessageType[]).map((t) => (
                              <DropdownMenuItem
                                key={t}
                                onClick={() => setSlMessages((p) => [...p, { type: t, content: "" }])}
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {slMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {slMessages.map((m, idx) => (
                            <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setSlMessages((prev) => prev.filter((_, i) => i !== idx))}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label="Remover mensagem"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={m.content}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSlMessages((prev) => prev.map((it, i) => (i === idx ? { ...it, content: val } : it)));
                                }}
                                className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {selected?.kind === "function" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="fn-name">Nome da Função</Label>
                      <Input
                        id="fn-name"
                        value={fnName}
                        onChange={(e) => setFnName(e.target.value.replace(/\s+/g, ""))}
                        placeholder="get_availability"
                        className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fn-desc">Descrição</Label>
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
                      <Label htmlFor="server-url">URL do Webhook</Label>
                      <Input
                        id="server-url"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="https://seu-dominio.com/webhook"
                        className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fn-params">Parameters (JSON Schema)</Label>
                      <Textarea
                        id="fn-params"
                        rows={10}
                        value={fnParams}
                        onChange={(e) => setFnParams(e.target.value)}
                        spellCheck={false}
                        className="border-white/[0.08] bg-background/40 font-mono text-[11px] backdrop-blur-xl"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Deve ser um JSON Schema válido com{" "}
                        <span className="font-mono">"type": "object"</span>.
                      </p>
                    </div>
                  </div>
                )}

                {selected?.kind === "comingSoon" && (
                  <div className="rounded-xl border border-dashed border-white/[0.1] bg-background/20 p-6 text-center">
                    <div
                      className={cn(
                        "mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl",
                        selected.iconBg,
                        selected.iconColor,
                      )}
                    >
                      <selected.icon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {selected.label} — em breve
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Configuração nativa de integração em breve. Utilize o{" "}
                      <span className="text-foreground">API Request</span> para
                      conectar via Webhook por enquanto.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-white/[0.06] px-6 py-4">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || selected?.kind === "comingSoon"}
                  className="gap-2"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
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
