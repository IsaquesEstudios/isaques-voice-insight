import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { WebCallDialog } from "@/components/assistants/web-call-dialog";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { PhoneCall } from "lucide-react";
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
  Check,
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
  Calendar,
  CalendarPlus,
  CalendarCheck,
  UserPlus,
  UserRound,
  Users,
  Code2,
  Sparkles,
  Phone,
  PhoneOff as PhoneOffIcon,
  Info,
  Globe,
  Lock,
  Mic,
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
  listAssistantCalls,
  getAssistantAnalytics,
  listVapiAssistants,
  listVapiVoices,
  saveVapiAssistantConfig,
  fetchRecordingAsDataUrl,
  getAssistantStructuredSchema,
  updateAssistantStructuredSchema,
  type AssistantCallLog,
  type VapiVoiceOption,
} from "@/lib/vapi.functions";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getModelCost,
  getModelSpec,
  getVoiceCost,
  getVoiceSpec,
  STT_COST_PER_MIN,
  VAPI_PLATFORM_FEE_PER_MIN,
  DEFAULT_TRANSCRIBER,
  getTranscriberSpec,
  formatUSDPerMin,
} from "@/lib/vapi-pricing";
import { CostHint, CostSummary } from "@/components/assistants/cost-hint";


export const Route = createFileRoute("/_authenticated/assistants/$id")({
  head: () => ({
    meta: [{ title: "Detalhes do Assistente — Isaques Estúdios | AI Voice" }],
  }),
  component: AssistantDetailPage,
});

// Slider genérico com label + valor + botão "limpar" (deixa null = usa padrão da Vapi).
function SliderField({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const active = value != null;
  const display = active ? value : (min + max) / 2;
  return (
    <div className="space-y-2 rounded-lg border border-white/[0.06] bg-background/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-xs", active ? "text-foreground" : "text-muted-foreground")}>
            {active ? display.toFixed(step < 1 ? 2 : 0) : "padrão"}
          </span>
          {active && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              limpar
            </button>
          )}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[display]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}



// Provedores/modelos/vozes só com IDs documentados em docs.vapi.ai/providers/*
const MODEL_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "groq", label: "Groq" },
  { value: "xai", label: "xAI" },
];

// Fonte: enums oficiais do OpenAPI da Vapi (https://api.vapi.ai/api-json)
// Só listamos modelos que a Vapi aceita hoje no campo `model.model`.
const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 mini" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 nano" },
    { value: "gpt-5.2", label: "GPT-5.2" },
    { value: "gpt-5.1", label: "GPT-5.1" },
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-mini", label: "GPT-5 mini" },
    { value: "gpt-5-nano", label: "GPT-5 nano" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
    { value: "chatgpt-4o-latest", label: "ChatGPT-4o latest" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "o3", label: "o3" },
    { value: "o3-mini", label: "o3-mini" },
    { value: "o4-mini", label: "o4-mini" },
    { value: "o1-mini", label: "o1-mini" },
    // Realtime — obrigatórios para vozes ash/ballad/coral/sage/verse
    { value: "gpt-realtime-2", label: "GPT Realtime 2 (recomendado)" },
    { value: "gpt-realtime-2025-08-28", label: "GPT Realtime (2025-08-28)" },
    { value: "gpt-realtime-mini-2025-12-15", label: "GPT Realtime mini (2025-12-15)" },
    { value: "gpt-4o-realtime-preview-2024-12-17", label: "GPT-4o Realtime (2024-12-17)" },
    { value: "gpt-4o-realtime-preview-2024-10-01", label: "GPT-4o Realtime (2024-10-01)" },
    { value: "gpt-4o-mini-realtime-preview-2024-12-17", label: "GPT-4o mini Realtime (2024-12-17)" },
  ],
  anthropic: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "claude-opus-4-5-20251101", label: "Claude Opus 4.5" },
    { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  google: [
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { value: "gemini-2.0-flash-realtime-exp", label: "Gemini 2.0 Flash Realtime (exp)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  groq: [
    { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
    { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    { value: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick 17B" },
    { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
    { value: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 Instruct" },
    { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B" },
    { value: "mistral-saba-24b", label: "Mistral Saba 24B" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
  xai: [
    { value: "grok-4.3", label: "Grok 4.3" },
    { value: "grok-4-fast-reasoning", label: "Grok 4 Fast (reasoning)" },
    { value: "grok-4-fast-non-reasoning", label: "Grok 4 Fast (non-reasoning)" },
    { value: "grok-3", label: "Grok 3" },
    { value: "grok-2", label: "Grok 2" },
  ],
};

// Provedores de voz — Vapi (com vozes proprietárias como Elliot) + PT-BR via BYOK.
const VOICE_PROVIDERS = [
  { value: "vapi", label: "Vapi (nativo)" },
  { value: "11labs", label: "ElevenLabs (BYOK) — PT-BR" },
  { value: "azure", label: "Azure (BYOK) — PT-BR" },
];

// Padrões de IA pré-configurados. Ao selecionar, aplica transcriber + model + voice.
interface AiPreset {
  id: string;
  label: string;
  description: string;
  transcriber: { provider: string; model: string; language?: string };
  model: { provider: string; model: string };
  voice: { provider: string; voiceId: string };
}

const AI_PRESETS: AiPreset[] = [
  {
    id: "matteus",
    label: "Matteus",
    description: "Deepgram Nova-3 · GPT-4.1 nano · Elliot v2",
    transcriber: { provider: "deepgram", model: "nova-3", language: "pt-BR" },
    model: { provider: "openai", model: "gpt-4.1-nano" },
    voice: { provider: "vapi", voiceId: "Elliot" },
  },
];

// Vapi Voices ativas — https://docs.vapi.ai/providers/voice/vapi-voices
// OpenAI/Deepgram: IDs fixos e documentados.
// ElevenLabs: lista pública de vozes multilíngues + vozes brasileiras da Voice Library.
// IDs da Voice Library podem mudar; se um falhar, use o input manual ou troque de voz.
const VOICES_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  vapi: [
    { value: "Elliot", label: "Elliot V2 — Male, Canadian" },
    { value: "Savannah", label: "Savannah V2 — Female, Southern US" },
    { value: "Rohan", label: "Rohan — Male, Indian American" },
    { value: "Emma", label: "Emma V2 — Female, Asian American" },
    { value: "Clara", label: "Clara V2 — Female, American" },
    { value: "Nico", label: "Nico V2 — Male, American" },
    { value: "Kai", label: "Kai V2 — Male, American" },
    { value: "Sagar", label: "Sagar V2 — Male, Indian American" },
    { value: "Godfrey", label: "Godfrey V2 — Male, American" },
    { value: "Neil", label: "Neil V2 — Male, Indian American" },
    { value: "Layla", label: "Layla V2 — Female, American" },
    { value: "Sid", label: "Sid V2 — Male, American" },
    { value: "Naina", label: "Naina V2 — Female, Indian American" },
  ],
  openai: [
    { value: "alloy", label: "Alloy" },
    { value: "echo", label: "Echo" },
    { value: "fable", label: "Fable" },
    { value: "onyx", label: "Onyx" },
    { value: "nova", label: "Nova" },
    { value: "shimmer", label: "Shimmer" },
    { value: "marin", label: "Marin" },
    { value: "cedar", label: "Cedar" },
    // Realtime-only — exigem modelo gpt-realtime-* ou gpt-4o-realtime-preview-*
    { value: "ash", label: "Ash (realtime)" },
    { value: "ballad", label: "Ballad (realtime)" },
    { value: "coral", label: "Coral (realtime)" },
    { value: "sage", label: "Sage (realtime)" },
    { value: "verse", label: "Verse (realtime)" },
  ],
  deepgram: [
    // Vapi valida contra o nome curto (ex.: "thalia"), não o slug "aura-2-thalia-en".
    { value: "thalia", label: "Thalia (EN)" },
    { value: "orion", label: "Orion (EN)" },
    { value: "luna", label: "Luna (EN)" },
    { value: "asteria", label: "Asteria (EN)" },
    { value: "athena", label: "Athena (EN)" },
    { value: "hera", label: "Hera (EN)" },
    { value: "zeus", label: "Zeus (EN)" },
    { value: "helios", label: "Helios (EN)" },
    { value: "perseus", label: "Perseus (EN)" },
    { value: "andromeda", label: "Andromeda (EN)" },
    { value: "helena", label: "Helena (EN)" },
    { value: "apollo", label: "Apollo (EN)" },
    { value: "estrella", label: "Estrella (ES)" },
    { value: "celeste", label: "Celeste (ES)" },
    { value: "javier", label: "Javier (ES)" },
    { value: "diana", label: "Diana (ES)" },
  ],
  "11labs": [
    // Somente vozes nativas em Português (Brasil) da ElevenLabs Voice Library.
    // Vozes multilíngues foram removidas porque saem com sotaque estrangeiro.
    { value: "NQ10OlqJ7vYH6XwegHSW", label: "Lucke — PT-BR, masculino" },
    { value: "dX7gRq1dIvLTgUaWpEFn", label: "Rafael Valente — PT-BR, narrador" },
    { value: "cFylwQo5ufGYUNyRS167", label: "Luka — PT-BR, masculino jovem" },
    { value: "CstacWqMhJQlnfLPxRG4", label: "Will (Deep) — PT-BR, narrador infantil" },
    { value: "y3X5crcIDtFawPx7bcNq", label: "Eliel — PT-BR, contador de histórias" },
    { value: "eVXYtPVYB9wDoz9NVTIy", label: "Carla Voice — PT-BR, feminino jovem" },
    { value: "AaeZyyi87RCxtFnHPS3e", label: "Prof. Campanholi — PT-BR, didático" },
    { value: "EIkHVdkuarjkYUyMnoes", label: "Nelton — PT-BR, audiobooks" },
    { value: "qarDw4DEvUqP3FBlpO0T", label: "Jon Oliveira — PT-BR, comercial" },
    { value: "33B4UnXyTNbgLmdEDh5P", label: "Keren — PT-BR, feminino doce" },
    { value: "RGymW84CSmfVugnA5tvA", label: "Roberta — PT-BR, conversacional" },
    { value: "rpNe0HOx7heUulPiOEaG", label: "Diego — PT-BR, propaganda" },
    { value: "tS45q0QcrDHqHoaWdCDR", label: "Lax — PT-BR, engraçado/sarcástico" },
    { value: "r2fkFV8WAqXq2AqBpgJT", label: "Amandoca — PT-BR, feminino divertido" },
    { value: "MZxV5lN3cv7hi1376O0m", label: "Ana Dias — PT-BR, feminino envolvente" },
    { value: "9pDzHy2OpOgeXM8SeL0t", label: "Borges — PT-BR, masculino calmo" },
    { value: "GDzHdQOi6jjf8zaXhCYD", label: "Raquel — PT-BR, expressiva" },
    { value: "7lu3ze7orhWaNeSPowWx", label: "Lucas — PT-BR, social media" },
    { value: "YNOujSUmHtgN6anjqXPf", label: "Victor Power — PT-BR, ebooks" },
    { value: "qPfM2laM0pRL4rrZtBGl", label: "Sandro Dutra — PT-BR, articulado" },
    { value: "7u8qsX4HQsSHJ0f8xsQZ", label: "João Pedro — PT-BR, dinâmico" },
    { value: "bJrNspxJVFovUxNBQ0wh", label: "Marcelo Costa — PT-BR, artístico" },
    { value: "lWq4KDY8znfkV0DrK8Vb", label: "Yasmin Alves — PT-BR, feminino" },
    { value: "oi8rgjIfLgJRsQ6rbZh3", label: "Amanda Kelly — PT-BR, doce" },
    { value: "Qrdut83w0Cr152Yb4Xn3", label: "Paulo — PT-BR, informativo" },
    { value: "83Nae6GFQiNslSbuzmE7", label: "Eduardo Monteiro — PT-BR, nordestino" },
    { value: "6pQlwCgfwffNdI3jjzM6", label: "Fernando Borges — PT-BR, urbano" },
    { value: "hwnuNyWkl9DjdTFykrN6", label: "Adriano — PT-BR, grave" },
    { value: "5p9IbzcK4R8rN1fpGdMF", label: "Davi — PT-BR, amigável" },
    { value: "eUAnqvLQWNX29twcYLUM", label: "Dyego — PT-BR, noticiário" },
    { value: "OB6x7EbXYlhG4DDTB1XU", label: "Michelle — PT-BR, feminino jovem" },
    { value: "ZqE9vIHPcrC35dZv0Svu", label: "Adam Borges — PT-BR, sensual" },
    { value: "7iqXtOF3wl3pomwXFY7G", label: "Fernanda — PT-BR, profissional" },
    { value: "xNGAXaCH8MaasNuo7Hr7", label: "Beto — PT-BR, neutro/nativo" },
    { value: "HOfBIVLhom4mc9WvXfyH", label: "Andrea Lot — PT-BR, autoritário" },
    { value: "Eyspt3SYhZzXd1Jd3J8O", label: "Bia — PT-BR, direto" },
    { value: "wHnxjlY53t8X9Oi14Awz", label: "Juliano Magalhães — PT-BR, narrador" },
    { value: "u0Dga8xTuplGDHoYA40p", label: "Nina M. — PT-BR, feminino jovem" },
    { value: "kd1lRcSdRGIfyKxQKjmH", label: "Ale Garcia — PT-BR, descontraído" },
    { value: "ycxdm1PRMs962FxyyuJ0", label: "Otto — PT-BR, jovem/épico" },
    { value: "iScHbNW8K33gNo3lGgbo", label: "Marianne — PT-BR, doce/calma" },
    { value: "cyD08lEy76q03ER1jZ7y", label: "Scheila — PT-BR, séria" },
    { value: "rnJZLKxtlBZt77uIED10", label: "Sergio — PT-BR, sênior/grave" },
    { value: "vibfi5nlk3hs8Mtvf9Oy", label: "Ana — PT-BR, relaxada" },
    { value: "GnDrTQvdzZ7wqAKfLzVQ", label: "Guilherme — PT-BR, direto" },
    { value: "ETf5cmpNIbpSiXmBaR2m", label: "Samuel — PT-BR, lento/calmado" },
    { value: "5lrBPYY4YvMbKHTo8kvZ", label: "Arthur — PT-BR, profissional" },
    { value: "3Je7qW9yPOhc47iG41pH", label: "Yuri — PT-BR, convidativo" },
    { value: "YU8EsJtXFMyKMxYtheDk", label: "Mário — PT-BR, animado" },
    { value: "n2aB5UDlpf5USMJH7Qst", label: "Gilson Lima — PT-BR, articulado" },
    { value: "F7823wtD50WK1gnmgBk5", label: "Matheus Moretti — PT-BR, calmo" },
    { value: "TY3h8ANhQUsJaa0Bga5F", label: "Cassio Cruz — PT-BR, confiante" },
    { value: "GFPGeIuI7dxt6YeFLE7l", label: "Ayres — PT-BR, gentil" },
    { value: "IlrWo5tGgTuxNTHyGhWD", label: "Vagner de Souza — PT-BR, sério" },
    { value: "4RyYr3owp1gnOgHKTs6D", label: "Aline Mota — PT-BR, profissional" },
    { value: "Hmn4B9B77pf6ttydteJ8", label: "Kaique — PT-BR, poético" },
    { value: "LuQ9eaWO9yCQrR73VQFa", label: "Victor Pinho — PT-BR, jovial" },
    { value: "5EtawPduB139avoMLQgH", label: "Thais — PT-BR, feminino jovem" },
    { value: "k3f7zOv6LF88v78QHCNh", label: "Gabriel — PT-BR, dinâmico" },
  ],
  cartesia: [],
  playht: [],
  azure: [
    // Azure Neural TTS — vozes pt-BR (https://learn.microsoft.com/azure/ai-services/speech-service/language-support)
    { value: "pt-BR-FranciscaNeural", label: "Francisca — PT-BR, feminino" },
    { value: "pt-BR-AntonioNeural", label: "Antônio — PT-BR, masculino" },
    { value: "pt-BR-BrendaNeural", label: "Brenda — PT-BR, feminino" },
    { value: "pt-BR-DonatoNeural", label: "Donato — PT-BR, masculino" },
    { value: "pt-BR-ElzaNeural", label: "Elza — PT-BR, feminino" },
    { value: "pt-BR-FabioNeural", label: "Fábio — PT-BR, masculino" },
    { value: "pt-BR-GiovannaNeural", label: "Giovanna — PT-BR, feminino" },
    { value: "pt-BR-HumbertoNeural", label: "Humberto — PT-BR, masculino" },
    { value: "pt-BR-JulioNeural", label: "Júlio — PT-BR, masculino" },
    { value: "pt-BR-LeilaNeural", label: "Leila — PT-BR, feminino" },
    { value: "pt-BR-LeticiaNeural", label: "Letícia — PT-BR, feminino" },
    { value: "pt-BR-ManuelaNeural", label: "Manuela — PT-BR, feminino" },
    { value: "pt-BR-NicolauNeural", label: "Nicolau — PT-BR, masculino" },
    { value: "pt-BR-ThalitaNeural", label: "Thalita — PT-BR, feminino" },
    { value: "pt-BR-ValerioNeural", label: "Valério — PT-BR, masculino" },
    { value: "pt-BR-YaraNeural", label: "Yara — PT-BR, feminino" },
  ],
};

function isBrazilianPortugueseVoice(v: VapiVoiceOption): boolean {
  const haystack = [
    v.languageCode,
    v.language,
    v.accent,
    v.description,
    v.name,
    v.providerId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /\bpt[-_ ]?br\b/.test(haystack) ||
    haystack.includes("portuguese (brazil)") ||
    haystack.includes("português (brasil)") ||
    haystack.includes("brazilian portuguese") ||
    haystack.includes("brasileiro") ||
    haystack.includes("brasileira")
  );
}

interface FormState {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  modelProvider: string;
  model: string;
  voiceProvider: string;
  voiceId: string;
  status: "Ativo" | "Rascunho";
  // Voice tuning
  voiceModel: string;
  voiceStability: number | null;
  voiceSimilarityBoost: number | null;
  voiceStyle: number | null;
  voiceUseSpeakerBoost: boolean;
  voiceSpeed: number | null;
  voiceEmotion: string;
  voiceTemperature: number | null;
  voiceFillerInjectionEnabled: boolean;
  // Speaking plans
  startWaitSeconds: number | null;
  smartEndpointingEnabled: boolean;
  stopNumWords: number | null;
  stopVoiceSeconds: number | null;
  stopBackoffSeconds: number | null;
  // Background
  backgroundSound: "off" | "office";
  backgroundDenoisingEnabled: boolean;
  // Transcriber
  transcriberProvider: string;
  transcriberModel: string;
  transcriberLanguage: string;
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
  voiceModel: "",
  voiceStability: null,
  voiceSimilarityBoost: null,
  voiceStyle: null,
  voiceUseSpeakerBoost: false,
  voiceSpeed: null,
  voiceEmotion: "",
  voiceTemperature: null,
  voiceFillerInjectionEnabled: false,
  startWaitSeconds: null,
  smartEndpointingEnabled: false,
  stopNumWords: null,
  stopVoiceSeconds: null,
  stopBackoffSeconds: null,
  backgroundSound: "off",
  backgroundDenoisingEnabled: false,
  transcriberProvider: "",
  transcriberModel: "",
  transcriberLanguage: "",
};

// ---- Regras de compatibilidade voz ↔ modelo ------------------------------
// OpenAI: vozes "realtime-only" só funcionam com modelos gpt-*-realtime-*.
const OPENAI_REALTIME_VOICES = new Set(["ash", "ballad", "coral", "sage", "verse"]);

function isRealtimeModel(model: string): boolean {
  return /realtime/i.test(model);
}

interface CompatIssue {
  ok: false;
  fields: Array<"model" | "voice">;
  message: string;
}
type CompatResult = { ok: true } | CompatIssue;

function checkVoiceModelCompat(
  voiceProvider: string,
  voiceId: string,
  _modelProvider: string,
  model: string,
): CompatResult {
  if (voiceProvider === "openai" && OPENAI_REALTIME_VOICES.has(voiceId)) {
    if (!isRealtimeModel(model)) {
      return {
        ok: false,
        fields: ["model", "voice"],
        message: `A voz "${voiceId}" (OpenAI) só funciona com modelos realtime (ex.: gpt-4o-realtime-preview-2024-12-17). Troque o modelo ou escolha outra voz.`,
      };
    }
  }
  return { ok: true };
}

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
  const [webCallOpen, setWebCallOpen] = useState(false);

  const compat = useMemo(
    () =>
      checkVoiceModelCompat(
        form.voiceProvider,
        form.voiceId,
        form.modelProvider,
        form.model,
      ),
    [form.voiceProvider, form.voiceId, form.modelProvider, form.model],
  );
  const compatBad = !compat.ok;
  const compatModelBad = compatBad && compat.fields.includes("model");
  const compatVoiceBad = compatBad && compat.fields.includes("voice");


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
        const v = (a?.voice ?? {}) as Record<string, unknown>;
        const ssp = (a?.startSpeakingPlan ?? {}) as Record<string, unknown>;
        const stp = (a?.stopSpeakingPlan ?? {}) as Record<string, unknown>;
        const numOrNull = (x: unknown): number | null =>
          typeof x === "number" && Number.isFinite(x) ? x : null;
        setForm({
          name: typeof a.name === "string" ? a.name : "",
          firstMessage: typeof a.firstMessage === "string" ? a.firstMessage : "",
          systemPrompt,
          modelProvider: typeof a?.model?.provider === "string" ? a.model.provider : "",
          model: typeof a?.model?.model === "string" ? a.model.model : "",
          voiceProvider: typeof a?.voice?.provider === "string" ? a.voice.provider : "",
          voiceId: typeof a?.voice?.voiceId === "string" ? a.voice.voiceId : "",
          status: typeof a.name === "string" && a.name.trim() ? "Ativo" : "Rascunho",
          voiceModel: typeof v.model === "string" ? v.model : "",
          voiceStability: numOrNull(v.stability),
          voiceSimilarityBoost: numOrNull(v.similarityBoost),
          voiceStyle: numOrNull(v.style),
          voiceUseSpeakerBoost: v.useSpeakerBoost === true,
          voiceSpeed: numOrNull(v.speed),
          voiceEmotion: typeof v.emotion === "string" ? v.emotion : "",
          voiceTemperature: numOrNull(v.temperature),
          voiceFillerInjectionEnabled: v.fillerInjectionEnabled === true,
          startWaitSeconds: numOrNull(ssp.waitSeconds),
          smartEndpointingEnabled: ssp.smartEndpointingEnabled === true,
          stopNumWords: numOrNull(stp.numWords),
          stopVoiceSeconds: numOrNull(stp.voiceSeconds),
          stopBackoffSeconds: numOrNull(stp.backoffSeconds),
          backgroundSound: (a as { backgroundSound?: string })?.backgroundSound === "office" ? "office" : "off",
          backgroundDenoisingEnabled: (a as { backgroundDenoisingEnabled?: boolean })?.backgroundDenoisingEnabled === true,
          transcriberProvider: typeof a?.transcriber?.provider === "string" ? a.transcriber.provider : "",
          transcriberModel: typeof a?.transcriber?.model === "string" ? a.transcriber.model : "",
          transcriberLanguage: typeof a?.transcriber?.language === "string" ? a.transcriber.language : "",
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

  // Fetch voices from Vapi voice-library for the selected provider.
  const listVoicesFn = useServerFn(listVapiVoices);
  const voicesQuery = useQuery({
    queryKey: ["vapi-voices", form.voiceProvider],
    queryFn: () => listVoicesFn({ data: { provider: form.voiceProvider } }),
    enabled: !!form.voiceProvider,
    staleTime: 1000 * 60 * 30,
  });

  // Vozes estáticas como fallback quando a API da Vapi não retorna nada
  // (ex.: ElevenLabs BYOK não expõe a biblioteca pública).
  const staticVoices = useMemo<VapiVoiceOption[]>(() => {
    const hardcoded = VOICES_BY_PROVIDER[form.voiceProvider] ?? [];
    if (hardcoded.length === 0) return [];
    return hardcoded.map((v) => ({
      providerId: v.value,
      name: v.label.split(" — ")[0],
      languageCode: form.voiceProvider === "11labs" ? "pt-br" : undefined,
      language: form.voiceProvider === "11labs" ? "Portuguese (Brazil)" : undefined,
      gender: undefined,
      accent: undefined,
      previewUrl: undefined,
      description: undefined,
    }));
  }, [form.voiceProvider]);

  const apiVoices = voicesQuery.data ?? [];
  const elevenLabsPtBrVoices = useMemo(
    () => apiVoices.filter(isBrazilianPortugueseVoice),
    [apiVoices],
  );

  // ElevenLabs usa somente a lista real retornada pela Vapi, filtrada para PT-BR.
  // O fallback estático anterior mostrava IDs públicos que podem não existir na
  // conta ElevenLabs conectada à Vapi, causando o erro "Couldn't Find 11labs Voice".
  const allVoices = form.voiceProvider === "11labs"
    ? elevenLabsPtBrVoices
    : form.voiceProvider === "azure"
      ? staticVoices
      : (apiVoices.length ? apiVoices : staticVoices);

  // Se a lista de vozes carregou (API ou fallback) e o voiceId atual não está nela,
  // a Vapi rejeitará o PATCH com 400 ("voice.voiceId must be one of ...").
  const voiceListMismatch = useMemo(() => {
    if (!form.voiceProvider || !form.voiceId) return false;
    if (voicesQuery.isLoading) return false;
    const list = allVoices;
    const hasAuthoritativeElevenLabsList =
      form.voiceProvider === "11labs" && !voicesQuery.isError && Array.isArray(voicesQuery.data);
    if (list.length === 0) return hasAuthoritativeElevenLabsList;
    const target = form.voiceId.toLowerCase();
    return !list.some((v) => (v.providerId || "").toLowerCase() === target);
  }, [form.voiceProvider, form.voiceId, voicesQuery.isLoading, voicesQuery.isError, voicesQuery.data, allVoices]);
  const elevenLabsVoiceUnavailable =
    form.voiceProvider === "11labs" && !voicesQuery.isLoading && allVoices.length === 0;
  const voiceSelectionMissing = Boolean(form.voiceProvider && allVoices.length > 0 && !form.voiceId);

  // Traduções pt-BR para metadados vindos da API da Vapi.
  const translateLanguage = (raw?: string, code?: string): string => {
    const key = (code || raw || "").toLowerCase().trim();
    const byCode: Record<string, string> = {
      "pt-br": "Português (Brasil)",
      "pt-pt": "Português (Portugal)",
      pt: "Português",
      "en-us": "Inglês (EUA)",
      "en-gb": "Inglês (Reino Unido)",
      "en-au": "Inglês (Austrália)",
      en: "Inglês",
      "es-es": "Espanhol (Espanha)",
      "es-mx": "Espanhol (México)",
      es: "Espanhol",
      "fr-fr": "Francês",
      fr: "Francês",
      "de-de": "Alemão",
      de: "Alemão",
      "it-it": "Italiano",
      it: "Italiano",
      "ja-jp": "Japonês",
      ja: "Japonês",
      "ko-kr": "Coreano",
      ko: "Coreano",
      "zh-cn": "Chinês (Mandarim)",
      zh: "Chinês",
      "ru-ru": "Russo",
      ru: "Russo",
      "nl-nl": "Holandês",
      nl: "Holandês",
      "pl-pl": "Polonês",
      pl: "Polonês",
      "tr-tr": "Turco",
      tr: "Turco",
      "ar-sa": "Árabe",
      ar: "Árabe",
      "hi-in": "Hindi",
      hi: "Hindi",
      multi: "Multilíngue",
      multilingual: "Multilíngue",
    };
    if (byCode[key]) return byCode[key];
    const label = (raw || code || "").trim();
    if (!label) return "";
    // Traduções por nome inglês -> pt-BR (fallback quando não há código).
    const byLabel: Record<string, string> = {
      portuguese: "Português",
      "portuguese (brazil)": "Português (Brasil)",
      "portuguese (portugal)": "Português (Portugal)",
      english: "Inglês",
      "english (us)": "Inglês (EUA)",
      "english (united states)": "Inglês (EUA)",
      "english (uk)": "Inglês (Reino Unido)",
      spanish: "Espanhol",
      french: "Francês",
      german: "Alemão",
      italian: "Italiano",
      japanese: "Japonês",
      korean: "Coreano",
      chinese: "Chinês",
      russian: "Russo",
      dutch: "Holandês",
      polish: "Polonês",
      turkish: "Turco",
      arabic: "Árabe",
      multilingual: "Multilíngue",
    };
    return byLabel[label.toLowerCase()] ?? label;
  };

  const translateGender = (g?: string): string => {
    const key = (g || "").toLowerCase().trim();
    if (key === "male" || key === "m") return "Masculino";
    if (key === "female" || key === "f") return "Feminino";
    if (key === "neutral" || key === "non-binary") return "Neutro";
    return g ?? "";
  };

  const translateAccent = (a?: string): string => {
    const key = (a || "").toLowerCase().trim();
    const map: Record<string, string> = {
      american: "Americano",
      british: "Britânico",
      australian: "Australiano",
      indian: "Indiano",
      brazilian: "Brasileiro",
      european: "Europeu",
      neutral: "Neutro",
    };
    return map[key] ?? a ?? "";
  };

  // Build list of languages present in this provider's voice library.
  const languageOptions = useMemo(() => {
    const map = new Map<string, string>(); // code -> label traduzido
    for (const v of allVoices) {
      const code = (v.languageCode || v.language || "").trim();
      if (!code) continue;
      const label = translateLanguage(v.language, v.languageCode) || code;
      if (!map.has(code)) map.set(code, label);
    }
    return Array.from(map.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [allVoices]);

  const hasLanguageData = languageOptions.length > 0;
  const [languageFilter, setLanguageFilter] = useState<string>("all");

  // When voices load, default the filter to pt-BR / pt if available.
  useEffect(() => {
    if (!hasLanguageData) return;
    const codes = languageOptions.map((l) => l.code.toLowerCase());
    const preferred = codes.find((c) => c === "pt-br")
      ?? codes.find((c) => c.startsWith("pt"))
      ?? codes.find((c) => /portug/i.test(languageOptions.find((l) => l.code.toLowerCase() === c)?.label ?? ""));
    if (preferred) {
      const match = languageOptions.find((l) => l.code.toLowerCase() === preferred);
      if (match) setLanguageFilter(match.code);
    }
  }, [hasLanguageData, languageOptions]);

  const filteredVoices = useMemo(() => {
    if (!hasLanguageData || languageFilter === "all") return allVoices;
    return allVoices.filter(
      (v) => (v.languageCode || v.language || "") === languageFilter,
    );
  }, [allVoices, languageFilter, hasLanguageData]);

  const voiceOptions = filteredVoices.map((v) => {
    const meta = [
      translateLanguage(v.language, v.languageCode),
      translateAccent(v.accent),
      translateGender(v.gender),
    ].filter(Boolean).join(" · ");
    return {
      value: v.providerId,
      label: meta ? `${v.name} — ${meta}` : v.name,
      previewUrl: v.previewUrl,
    };
  });


  async function handleSave() {
    if (elevenLabsVoiceUnavailable) {
      toast.error("Nenhuma voz ElevenLabs PT-BR disponível.", {
        description:
          "A Vapi não retornou nenhuma voz brasileira da ElevenLabs para esta conta. Sincronize uma voz PT-BR na Vapi ou use Azure.",
      });
      return;
    }
    if (voiceSelectionMissing) {
      toast.error("Selecione uma voz antes de salvar.");
      return;
    }
    if (voiceListMismatch) {
      toast.error(
        form.voiceProvider === "11labs"
          ? `A voz "${form.voiceId}" não foi encontrada na lista ElevenLabs PT-BR disponível na Vapi. Escolha uma voz do dropdown ou use Azure.`
          : `A voz "${form.voiceId}" não pertence ao provider "${form.voiceProvider}". Selecione uma voz válida.`,
      );
      return;
    }
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
          voiceModel: form.voiceModel || null,
          voiceStability: form.voiceStability,
          voiceSimilarityBoost: form.voiceSimilarityBoost,
          voiceStyle: form.voiceStyle,
          voiceUseSpeakerBoost: form.voiceUseSpeakerBoost,
          voiceSpeed: form.voiceSpeed,
          voiceEmotion: form.voiceEmotion || null,
          voiceTemperature: form.voiceTemperature,
          voiceFillerInjectionEnabled: form.voiceFillerInjectionEnabled,
          startWaitSeconds: form.startWaitSeconds,
          smartEndpointingEnabled: form.smartEndpointingEnabled,
          stopNumWords: form.stopNumWords,
          stopVoiceSeconds: form.stopVoiceSeconds,
          stopBackoffSeconds: form.stopBackoffSeconds,
          backgroundSound: form.backgroundSound,
          backgroundDenoisingEnabled: form.backgroundDenoisingEnabled,
          transcriberProvider: form.transcriberProvider || null,
          transcriberModel: form.transcriberModel || null,
          transcriberLanguage: form.transcriberLanguage || null,
        },
      });

      toast.success("Alterações salvas.");
    } catch (err) {
      console.error("Save error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      const isElevenLabsVoiceError = /elevenlabs|11labs|voz/i.test(msg) && /não encontrada|couldn'?t find|find/i.test(msg);
      toast.error(isElevenLabsVoiceError ? "Voz ElevenLabs indisponível." : "Erro ao salvar alterações.", {
        description: msg.slice(0, 500),
      });
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setWebCallOpen(true)}
              disabled={isLoading}
              className="gap-2 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            >
              <PhoneCall className="h-4 w-4" />
              Testar no navegador
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading || compatBad || voiceListMismatch || elevenLabsVoiceUnavailable || voiceSelectionMissing}
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
        </div>

        <Tabs defaultValue="assistant" className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-white/[0.08] bg-card/20 p-1 backdrop-blur-2xl">
            {[
              { value: "assistant", label: "Assistant", icon: Brain },
              { value: "model", label: "Modelo & Voz", icon: Mic },
              { value: "logs", label: "Logs", icon: ScrollText },
              { value: "tools", label: "Tools", icon: Wrench },
              { value: "analysis", label: "Analysis", icon: LineChart },
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
            <div className="grid grid-cols-1 gap-4">


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
            </div>
          </TabsContent>

          <TabsContent value="model" className="mt-0">
            <div className="grid grid-cols-1 gap-4">

              {/* Padrões de IA pré-configurados */}
              <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Padrão de IA</h2>
                    <p className="text-xs text-muted-foreground">
                      Selecione um padrão pronto e aplique transcriber, modelo e voz de uma vez.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {AI_PRESETS.map((p) => {
                      const isActive =
                        form.transcriberProvider === p.transcriber.provider &&
                        form.transcriberModel === p.transcriber.model &&
                        form.modelProvider === p.model.provider &&
                        form.model === p.model.model &&
                        form.voiceProvider === p.voice.provider &&
                        form.voiceId === p.voice.voiceId;
                      const modelSpec = getModelSpec(p.model.provider, p.model.model);
                      const voiceSpec = getVoiceSpec(p.voice.provider, p.voice.voiceId);
                      const transcriberSpec =
                        getTranscriberSpec(p.transcriber.provider, p.transcriber.model) ??
                        DEFAULT_TRANSCRIBER;
                      const estCost =
                        VAPI_PLATFORM_FEE_PER_MIN +
                        transcriberSpec.costPerMin +
                        (modelSpec?.costPerMin ?? 0) +
                        (voiceSpec?.costPerMin ?? 0);
                      const estLatency =
                        transcriberSpec.latencyMs +
                        (modelSpec?.latencyMs ?? 0) +
                        (voiceSpec?.latencyMs ?? 0);

                      const latencyLabel =
                        estLatency >= 1000
                          ? `~${(estLatency / 1000).toFixed(2).replace(/\.?0+$/, "")}s`
                          : `~${Math.round(estLatency)}ms`;

                      const costTitle = "Previsão (fee Vapi + transcriber + modelo + voz)";
                      const latTitle = "Latência prevista (soma dos componentes)";

                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              transcriberProvider: p.transcriber.provider,
                              transcriberModel: p.transcriber.model,
                              transcriberLanguage: p.transcriber.language ?? "",
                              modelProvider: p.model.provider,
                              model: p.model.model,
                              voiceProvider: p.voice.provider,
                              voiceId: p.voice.voiceId,
                            }))
                          }
                          className={`rounded-xl border p-4 text-left transition ${
                            isActive
                              ? "border-primary/60 bg-primary/10"
                              : "border-white/[0.08] bg-background/40 hover:border-white/20 hover:bg-background/60"
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">{p.label}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{p.description}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className="rounded-full border border-white/[0.08] bg-background/60 px-2 py-0.5 text-[10px] font-medium text-foreground"
                              title={costTitle}
                            >
                              Custo previsto ~{formatUSDPerMin(estCost)}
                            </span>
                            <span
                              className="rounded-full border border-white/[0.08] bg-background/60 px-2 py-0.5 text-[10px] font-medium text-foreground"
                              title={latTitle}
                            >
                              Latência prevista {latencyLabel}
                            </span>
                          </div>
                        </button>
                      );



                    })}
                  </div>
                  {form.transcriberProvider && form.transcriberModel && (
                    <div className="rounded-lg border border-white/[0.06] bg-background/30 p-3 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Transcriber ativo:</span>{" "}
                      {form.transcriberProvider} · {form.transcriberModel}
                      {form.transcriberLanguage ? ` · ${form.transcriberLanguage}` : ""}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>



          <TabsContent value="logs" className="mt-0">
            <LogsTab assistantId={id} />
          </TabsContent>
          <TabsContent value="tools" className="mt-0">
            <ToolsTab
              id={id}
              tools={tools}
              onToolsChange={setTools}
              isLoading={isLoading}
              systemPrompt={form.systemPrompt}
              onSystemPromptChange={(value) => setForm((f) => ({ ...f, systemPrompt: value }))}
            />
          </TabsContent>
          <TabsContent value="analysis" className="mt-0">
            <AnalysisTab assistantId={id} />
          </TabsContent>
        </Tabs>
      </div>
      <WebCallDialog
        assistantId={id}
        assistantName={form.name?.trim() || "Assistente"}
        open={webCallOpen}
        onOpenChange={setWebCallOpen}
      />
    </DashboardShell>
  );
}

/* -------------------------------- Logs -------------------------------- */

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function endedReasonBadgeClass(reason: string | null): string {
  if (!reason) return "bg-white/[0.05] text-muted-foreground";
  if (/customer-ended/i.test(reason)) return "bg-emerald-500/10 text-emerald-300";
  if (/assistant-ended/i.test(reason)) return "bg-sky-500/10 text-sky-300";
  if (/error|failed|no-answer|busy/i.test(reason)) return "bg-rose-500/10 text-rose-300";
  if (/silence|voicemail/i.test(reason)) return "bg-amber-500/10 text-amber-300";
  return "bg-white/[0.05] text-muted-foreground";
}

const ENDED_REASON_PT: Record<string, string> = {
  "customer-ended-call": "Cliente encerrou",
  "assistant-ended-call": "IA encerrou",
  "customer-did-not-answer": "Não atendeu",
  "customer-busy": "Ocupado",
  "silence-timed-out": "Silêncio",
  "assistant-error": "Erro da IA",
  "pipeline-error": "Erro pipeline",
  "voicemail": "Caixa postal",
  "exceeded-max-duration": "Duração máx.",
};
function translateEndedReason(reason: string | null): string {
  if (!reason) return "—";
  return ENDED_REASON_PT[reason] ?? reason;
}

const CALL_TYPE_PT: Record<string, string> = {
  webCall: "Web (navegador)",
  inboundPhoneCall: "Telefone (entrada)",
  outboundPhoneCall: "Telefone (saída)",
};
function formatOrigin(row: AssistantCallLog): string {
  if (row.customerNumber) return row.customerNumber;
  if (row.phoneNumber) return row.phoneNumber;
  if (row.type && CALL_TYPE_PT[row.type]) return CALL_TYPE_PT[row.type];
  return row.type ?? "—";
}

function statusBadge(status: string | null): { label: string; className: string } {
  if (!status) return { label: "—", className: "bg-white/[0.05] text-muted-foreground" };
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: "Na fila", className: "bg-slate-500/10 text-slate-300" },
    ringing: { label: "Tocando", className: "bg-amber-500/10 text-amber-300" },
    "in-progress": { label: "Em andamento", className: "bg-sky-500/10 text-sky-300" },
    forwarding: { label: "Encaminhando", className: "bg-violet-500/10 text-violet-300" },
    ended: { label: "Finalizada", className: "bg-emerald-500/10 text-emerald-300" },
  };
  return map[status] ?? { label: status, className: "bg-white/[0.05] text-muted-foreground" };
}

function successBadge(v: string | null): { label: string; className: string } | null {
  if (!v) return null;
  const low = v.toLowerCase();
  if (low === "true" || low === "pass" || low === "success")
    return { label: "Sucesso", className: "bg-emerald-500/10 text-emerald-300" };
  if (low === "false" || low === "fail" || low === "failure")
    return { label: "Falhou", className: "bg-rose-500/10 text-rose-300" };
  return { label: v, className: "bg-white/[0.05] text-muted-foreground" };
}


function RecordingPlayer({ url, callId }: { url?: string | null; callId: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    (async () => {
      if (url) {
        // 1) Tenta fetch direto (funciona se o CDN mandar CORS).
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          if (cancelled) return;
          const objUrl = URL.createObjectURL(blob);
          revoke = objUrl;
          setBlobUrl(objUrl);
          setLoading(false);
          return;
        } catch {
          // segue pro proxy oficial da Vapi
        }
      }
      // 2) Fallback: baixa via endpoint oficial da Vapi com o ID da chamada.
      try {
        const { dataUrl } = await fetchRecordingAsDataUrl({ data: { url: url ?? undefined, callId } });
        if (cancelled) return;
        setBlobUrl(dataUrl);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Falha ao carregar áudio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [url, callId]);


  return (
    <div className="space-y-2">
      {loading && <p className="text-xs text-muted-foreground">Carregando gravação...</p>}
      {error && (
        <div className="space-y-1 rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-xs font-medium text-destructive">Não foi possível carregar a gravação.</p>
          <p className="text-[11px] text-destructive/90">
            O áudio foi encontrado na Vapi, mas não pôde ser carregado pelo player agora: {error}
          </p>
        </div>
      )}
      {blobUrl && (
        <audio controls preload="metadata" src={blobUrl} className="w-full">
          Seu navegador não suporta áudio.
        </audio>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[11px] text-primary underline"
          download
        >
          Abrir/baixar áudio original
        </a>
      )}
    </div>
  );
}

function CaptureView({ raw }: { raw: string | null }) {
  if (!raw) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] bg-background/20 p-8 text-center">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Nenhum dado capturado</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Configure os campos em <span className="text-foreground">Analysis → Structured Outputs</span>{" "}
          para que a IA extraia dados desta ligação (nome, telefone, status de agendamento, etc.).
        </p>
      </div>
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-background/40 p-3 text-xs text-foreground">
        {raw}
      </pre>
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-background/40 p-3 text-xs text-foreground">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Campos extraídos pela IA
      </p>
      <div className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-background/40">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-3 px-3 py-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">{k}</span>
            <span className="text-xs text-foreground break-words">
              {v === null || v === undefined
                ? "—"
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab({ assistantId }: { assistantId: string }) {

  const [limit, setLimit] = useState(50);
  const [detail, setDetail] = useState<AssistantCallLog | null>(null);
  const [detailMode, setDetailMode] = useState<"transcript" | "recording">("transcript");
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["vapi", "assistantCalls", assistantId, limit],
    queryFn: () => listAssistantCalls({ data: { assistantId, limit } }),
    staleTime: 30_000,
  });

  const calls = data?.calls ?? [];
  const apiError = data?.error ?? (error instanceof Error ? error.message : null);

  return (
    <>
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Histórico do Agente</h2>
              <p className="text-xs text-muted-foreground">
                Últimas ligações registradas pela Vapi para este assistente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur-xl">
                {calls.length} {calls.length === 1 ? "chamada" : "chamadas"}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["vapi", "assistantCalls", assistantId],
                  })
                }
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
              </Button>
            </div>
          </div>

          {apiError && (
            <div className="border-b border-rose-500/20 bg-rose-500/10 px-6 py-3 text-xs text-rose-200">
              Não foi possível carregar as ligações: {apiError}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Data/Hora</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Origem/Destino</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Duração</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Custo</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Motivo</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Avaliação</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="border-white/[0.04]">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!isLoading && calls.length === 0 && !apiError && (
                <TableRow className="border-white/[0.04] hover:bg-transparent">
                  <TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">
                    Nenhuma ligação registrada ainda para este assistente.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                calls.map((row) => {
                  const st = statusBadge(row.status);
                  const succ = successBadge(row.successEvaluation);
                  const bd = row.costBreakdown;
                  const hasBreakdown =
                    bd && (bd.stt || bd.llm || bd.tts || bd.vapi || bd.transport);
                  return (
                    <TableRow key={row.id} className="border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                      <TableCell className="text-sm text-foreground">{formatDateBR(row.startedAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatOrigin(row)}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", st.className)}>
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{formatDuration(row.durationSec)}</TableCell>
                      <TableCell className="text-sm text-foreground">
                        {row.cost != null ? (
                          hasBreakdown ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted underline-offset-2">
                                  ${row.cost.toFixed(3)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <div className="min-w-[140px] space-y-0.5">
                                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">STT</span><span>${(bd.stt ?? 0).toFixed(4)}</span></div>
                                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">LLM</span><span>${(bd.llm ?? 0).toFixed(4)}</span></div>
                                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">TTS</span><span>${(bd.tts ?? 0).toFixed(4)}</span></div>
                                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Vapi</span><span>${(bd.vapi ?? 0).toFixed(4)}</span></div>
                                  {bd.transport != null && (
                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Transporte</span><span>${bd.transport.toFixed(4)}</span></div>
                                  )}
                                  <div className="mt-1 flex justify-between gap-4 border-t border-white/10 pt-1 font-semibold"><span>Total</span><span>${row.cost.toFixed(3)}</span></div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            `$${row.cost.toFixed(3)}`
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            endedReasonBadgeClass(row.endedReason),
                          )}
                        >
                          {translateEndedReason(row.endedReason)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {succ ? (
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", succ.className)}>
                            {succ.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:text-primary disabled:opacity-30"
                            aria-label="Reproduzir áudio"
                            disabled={!row.id}
                            onClick={() => {
                              setDetail(row);
                              setDetailMode("recording");
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:text-primary disabled:opacity-30"
                            aria-label="Ver transcrição"
                            disabled={!row.transcript && !row.summary && !row.structuredData}
                            onClick={() => {
                              setDetail(row);
                              setDetailMode("transcript");
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>


          {!isLoading && calls.length >= limit && limit < 200 && (
            <div className="flex justify-center border-t border-white/[0.06] p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit((l) => Math.min(l + 50, 200))}
                className="h-8 border-white/[0.08] bg-card/20 backdrop-blur-xl"
              >
                Carregar mais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail != null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl border-white/[0.08] bg-card/80 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {detailMode === "recording" ? "Gravação da ligação" : "Transcrição da ligação"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detail && formatDateBR(detail.startedAt)} · {detail && formatDuration(detail.durationSec)}
              {detail?.customerNumber ? ` · ${detail.customerNumber}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && detailMode === "recording" && detail.id && (
            <RecordingPlayer url={detail.recordingUrl} callId={detail.id} />
          )}
          {detail && detailMode === "recording" && !detail.id && (
            <p className="text-xs text-muted-foreground">Gravação indisponível para esta ligação.</p>
          )}
          {detail && detailMode === "transcript" && (
            <Tabs defaultValue="transcript" className="w-full">
              <TabsList className="grid w-full grid-cols-2 border border-white/[0.06] bg-background/40">
                <TabsTrigger value="transcript" className="text-xs">Transcrição</TabsTrigger>
                <TabsTrigger value="capture" className="text-xs">
                  Captura
                  {detail.structuredData && (
                    <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                      ativo
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="transcript" className="mt-3 space-y-3">
                {detail.summary && (
                  <div className="rounded-lg border border-white/[0.06] bg-background/40 p-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Resumo</p>
                    <p className="text-xs text-foreground">{detail.summary}</p>
                  </div>
                )}
                {detail.transcript ? (
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-background/40 p-3 text-xs text-foreground">
                    {detail.transcript}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">Transcrição indisponível para esta ligação.</p>
                )}
              </TabsContent>

              <TabsContent value="capture" className="mt-3">
                <CaptureView raw={detail.structuredData} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}



/* -------------------------------- Tools -------------------------------- */

type VapiToolType = "transferCall" | "endCall" | "dtmf" | "voicemail" | "sms" | "sipRequest" | "handoff" | "query" | "apiRequest" | "mcp" | "slack" | "sheets" | "gcalCreate" | "gcalCheck" | "ghlCalCreate" | "ghlCalCheck" | "ghlContactCreate" | "ghlContactGet" | "function";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VapiTool = Record<string, any> & { type: string };

type CatalogKind = VapiToolType | "comingSoon" | "gcalParent" | "ghlParent";

interface CatalogItem {
  key: string;
  label: string;
  description: string;
  icon: typeof PhoneForwarded;
  iconColor: string; // tailwind text color class
  iconBg: string; // tailwind bg color class
  kind: CatalogKind;
  vapiType?: VapiToolType;
  subItems?: CatalogItem[];
  locked?: boolean;
  beta?: boolean;
}

interface CatalogSection {
  title: string;
  items: CatalogItem[];
}

interface ApiSchemaField {
  key: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
}

function ApiSchemaFieldsEditor({
  fields,
  onChange,
  emptyLabel,
  addLabel,
}: {
  fields: ApiSchemaField[];
  onChange: (next: ApiSchemaField[]) => void;
  emptyLabel: string;
  addLabel: string;
}) {
  const patch = (idx: number, p: Partial<ApiSchemaField>) =>
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...p } : f)));
  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-[11px] text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        fields.map((f, idx) => (
          <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={f.key}
                onChange={(e) => patch(idx, { key: e.target.value.replace(/\s+/g, "") })}
                placeholder="nome_da_propriedade"
                className="border-white/[0.08] bg-background/40 font-mono text-xs"
              />
              <Select value={f.type} onValueChange={(v) => patch(idx, { type: v as ApiSchemaField["type"] })}>
                <SelectTrigger className="w-32 border-white/[0.08] bg-background/40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["string", "number", "boolean", "object", "array"] as const).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onChange(fields.filter((_, i) => i !== idx))}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover propriedade"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Input
              value={f.description}
              onChange={(e) => patch(idx, { description: e.target.value })}
              placeholder="Descrição (ajuda a IA a preencher o valor)"
              className="border-white/[0.08] bg-background/40 text-xs"
            />
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Checkbox checked={f.required} onCheckedChange={(v) => patch(idx, { required: v === true })} />
              Obrigatório
            </label>
          </div>
        ))
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...fields, { key: "", type: "string", description: "", required: false }])}
        className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs"
      >
        <Plus className="h-3 w-3" />
        {addLabel}
      </Button>
    </div>
  );
}


const TOOL_CATALOG: CatalogSection[] = [
  {
    title: "Phone Call Tools",
    items: [
      { key: "transferCall", label: "Transfer Call", description: "Encaminha a ligação para um número externo.", icon: PhoneForwarded, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", kind: "transferCall", vapiType: "transferCall", beta: true },
      { key: "endCall", label: "Finalizar Chamada", description: "Permite que a IA encerre a ligação quando a conversa terminar.", icon: PhoneOff, iconColor: "text-rose-400", iconBg: "bg-rose-500/10", kind: "endCall", vapiType: "endCall", beta: true },
      { key: "voicemail", label: "Leave Voicemail", description: "Deixa uma mensagem quando ninguém atender.", icon: Voicemail, iconColor: "text-violet-400", iconBg: "bg-violet-500/10", kind: "voicemail", vapiType: "voicemail", locked: true },
      { key: "dtmf", label: "DTMF", description: "Envia tons DTMF durante a chamada.", icon: Hash, iconColor: "text-amber-400", iconBg: "bg-amber-500/10", kind: "dtmf", vapiType: "dtmf", locked: true },
      { key: "sendText", label: "Send Text", description: "Envia SMS durante ou após a chamada.", icon: MessageSquare, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", kind: "sms", vapiType: "sms", locked: true },
      { key: "sip", label: "SIP Request", description: "Executa requisições SIP customizadas.", icon: Radio, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", kind: "sipRequest", vapiType: "sipRequest", locked: true },
    ],
  },
  {
    title: "Assistant Tools",
    items: [
      { key: "handoff", label: "Handoff", description: "Transfere a conversa para outro assistente.", icon: Shuffle, iconColor: "text-orange-400", iconBg: "bg-orange-500/10", kind: "handoff", vapiType: "handoff", locked: true },
      { key: "query", label: "Query", description: "Consulta base de conhecimento indexada.", icon: Search, iconColor: "text-blue-500", iconBg: "bg-blue-500/10", kind: "query", vapiType: "query", locked: true },
    ],
  },
  {
    title: "Integrations",
    items: [
      { key: "apiRequest", label: "API Request", description: "Faz uma requisição HTTP para seu endpoint durante a chamada.", icon: Plug, iconColor: "text-sky-400", iconBg: "bg-sky-500/10", kind: "apiRequest", vapiType: "apiRequest", beta: true },
      { key: "mcp", label: "MCP", description: "Conecta a um servidor Model Context Protocol.", icon: ServerCog, iconColor: "text-red-400", iconBg: "bg-red-500/10", kind: "mcp", vapiType: "mcp", locked: true },
      { key: "slack", label: "Slack", description: "Envia mensagens e notificações para o Slack.", icon: Slack, iconColor: "text-purple-500", iconBg: "bg-purple-500/10", kind: "slack", vapiType: "slack", locked: true },
      { key: "sheets", label: "Google Sheets", description: "Lê e escreve em planilhas do Google.", icon: Sheet, iconColor: "text-green-500", iconBg: "bg-green-500/10", kind: "sheets", vapiType: "sheets", locked: true },
      {
        key: "gcal",
        label: "Google Calendar",
        description: "Cria eventos e verifica disponibilidade no Google Calendar.",
        icon: Calendar,
        iconColor: "text-blue-500",
        iconBg: "bg-blue-500/10",
        kind: "gcalParent",
        locked: true,
        subItems: [
          { key: "gcalCreate", label: "Create Event", description: "Cria um novo evento no Google Calendar.", icon: CalendarPlus, iconColor: "text-blue-500", iconBg: "bg-blue-500/10", kind: "gcalCreate", vapiType: "gcalCreate", locked: true },
          { key: "gcalCheck", label: "Check Availability", description: "Verifica disponibilidade em um Google Calendar.", icon: CalendarCheck, iconColor: "text-blue-500", iconBg: "bg-blue-500/10", kind: "gcalCheck", vapiType: "gcalCheck", locked: true },
        ],
      },
      {
        key: "ghl",
        label: "GoHighLevel",
        description: "Cria eventos, verifica disponibilidade e gerencia contatos no GoHighLevel.",
        icon: Users,
        iconColor: "text-amber-500",
        iconBg: "bg-amber-500/10",
        kind: "ghlParent",
        locked: true,
        subItems: [
          { key: "ghlCalCreate", label: "Calendar Create Event", description: "Cria um novo evento no calendário do GHL.", icon: CalendarPlus, iconColor: "text-orange-500", iconBg: "bg-orange-500/10", kind: "ghlCalCreate", vapiType: "ghlCalCreate", locked: true },
          { key: "ghlCalCheck", label: "Calendar Check Availability", description: "Verifica disponibilidade no calendário do GHL.", icon: CalendarCheck, iconColor: "text-orange-500", iconBg: "bg-orange-500/10", kind: "ghlCalCheck", vapiType: "ghlCalCheck", locked: true },
          { key: "ghlContactCreate", label: "Contact Create", description: "Cria um novo contato no GoHighLevel.", icon: UserPlus, iconColor: "text-amber-400", iconBg: "bg-amber-400/10", kind: "ghlContactCreate", vapiType: "ghlContactCreate", locked: true },
          { key: "ghlContactGet", label: "Contact Get", description: "Busca informações de um contato do GoHighLevel.", icon: UserRound, iconColor: "text-amber-400", iconBg: "bg-amber-400/10", kind: "ghlContactGet", vapiType: "ghlContactGet", locked: true },
        ],
      },
      { key: "customTool", label: "Custom Tool", description: "Ferramenta customizada via function calling.", icon: Code2, iconColor: "text-yellow-400", iconBg: "bg-yellow-400/10", kind: "function", vapiType: "function", locked: true },
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
      : type === "google.calendar.createEvent"
        ? "gcalCreate"
        : type === "google.calendar.checkAvailability"
          ? "gcalCheck"
          : type === "gohighlevel.calendar.event.create"
            ? "ghlCalCreate"
            : type === "gohighlevel.calendar.availability.check"
              ? "ghlCalCheck"
              : type === "gohighlevel.contact.create"
                ? "ghlContactCreate"
                : type === "gohighlevel.contact.get"
                  ? "ghlContactGet"
                  : type;
  for (const section of TOOL_CATALOG) {
    for (const item of section.items) {
      if (item.vapiType === normalized) return item;
      if (item.subItems) {
        for (const sub of item.subItems) {
          if (sub.vapiType === normalized) {
            // Return sub-item merged with a label prefix so cards show which variant.
            return { ...sub, label: `${item.label} — ${sub.label}` };
          }
        }
      }
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
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
}

type TransferMode =
  | "blind-transfer"
  | "blind-transfer-add-summary-to-sip-header"
  | "warm-transfer-say-message"
  | "warm-transfer-say-summary"
  | "warm-transfer-wait-for-operator-to-speak-first-and-then-say-message";

const TRANSFER_MODE_OPTIONS: { value: TransferMode; label: string; hint: string }[] = [
  {
    value: "blind-transfer",
    label: "Transferência direta (blind)",
    hint: "Passa a ligação imediatamente, sem avisar quem recebe.",
  },
  {
    value: "blind-transfer-add-summary-to-sip-header",
    label: "Direta + resumo no cabeçalho SIP",
    hint: "Igual à direta, mas envia um resumo da conversa no header SIP.",
  },
  {
    value: "warm-transfer-say-message",
    label: "Assistida — falar mensagem",
    hint: "A IA fala uma mensagem para quem recebe antes de conectar.",
  },
  {
    value: "warm-transfer-say-summary",
    label: "Assistida — falar resumo",
    hint: "A IA resume a conversa para quem recebe antes de conectar.",
  },
  {
    value: "warm-transfer-wait-for-operator-to-speak-first-and-then-say-message",
    label: "Assistida — esperar o atendente falar",
    hint: "Aguarda o atendente atender e falar, depois a IA passa a mensagem.",
  },
];

interface TransferDestinationBase {
  /** Condição em linguagem natural que a IA avalia para disparar a transferência. */
  description: string;
  /** O que a IA fala para o cliente antes de transferir. */
  message: string;
  mode: TransferMode;
  /** Mensagem dita para quem recebe (modos warm que exigem mensagem). */
  warmMessage: string;
}

type TransferDestination =
  | ({ type: "number"; number: string } & TransferDestinationBase)
  | ({ type: "sip"; sipUri: string } & TransferDestinationBase);

const EMPTY_TRANSFER_FIELDS: TransferDestinationBase = {
  description: "",
  message: "",
  mode: "blind-transfer",
  warmMessage: "",
};

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

function ToolsTab({
  id,
  tools,
  onToolsChange,
  isLoading,
  systemPrompt,
  onSystemPromptChange,
}: ToolsTabProps) {
  const saveConfig = useServerFn(saveVapiAssistantConfig);
  const [isInsertingRule, setIsInsertingRule] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // null = criando uma nova ferramenta; número = editando a ferramenta desse índice.
  const [editIndex, setEditIndex] = useState<number | null>(null);


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
  const [arAuthType, setArAuthType] = useState<"none" | "bearer" | "apiKey" | "basic">("none");
  const [arAuthToken, setArAuthToken] = useState("");
  const [arAuthHeaderName, setArAuthHeaderName] = useState("x-api-key");
  const [arTimeoutSeconds, setArTimeoutSeconds] = useState(20);
  const [arRetries, setArRetries] = useState(0);
  const [arBackoffType, setArBackoffType] = useState<"fixed" | "exponential">("fixed");
  const [arBackoffBaseDelay, setArBackoffBaseDelay] = useState(1000);
  const [arBodyParams, setArBodyParams] = useState<ApiSchemaField[]>([]);
  const [arResponseVars, setArResponseVars] = useState<ApiSchemaField[]>([]);
  const [arAliases, setArAliases] = useState<Array<{ name: string; value: string }>>([]);


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

  // google sheets configuration state
  const [gsName, setGsName] = useState("google_sheets_tool");
  const [gsDescription, setGsDescription] = useState("");
  const [gsSpreadsheetId, setGsSpreadsheetId] = useState("");
  const [gsRange, setGsRange] = useState("");
  const [gsMessages, setGsMessages] = useState<VoicemailMessage[]>([]);

  // google calendar configuration state (shared between createEvent and checkAvailability)
  const [gcName, setGcName] = useState("google_calendar_tool");
  const [gcDescription, setGcDescription] = useState("");
  const [gcCalendarId, setGcCalendarId] = useState("");
  const [gcTimezone, setGcTimezone] = useState("");
  const [gcMessages, setGcMessages] = useState<VoicemailMessage[]>([]);

  // gohighlevel configuration state (shared across the 4 GHL actions)
  const [ghlName, setGhlName] = useState("");
  const [ghlDescription, setGhlDescription] = useState("");
  const [ghlCalendarId, setGhlCalendarId] = useState("");
  const [ghlMessages, setGhlMessages] = useState<VoicemailMessage[]>([]);



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
    setArAuthType("none");
    setArAuthToken("");
    setArAuthHeaderName("x-api-key");
    setArTimeoutSeconds(20);
    setArRetries(0);
    setArBackoffType("fixed");
    setArBackoffBaseDelay(1000);
    setArBodyParams([]);
    setArResponseVars([]);
    setArAliases([]);

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
    setGsName("google_sheets_tool");
    setGsDescription("");
    setGsSpreadsheetId("");
    setGsRange("");
    setGsMessages([]);
    setGcName("google_calendar_tool");
    setGcDescription("");
    setGcCalendarId("");
    setGcTimezone("");
    setGcMessages([]);
    setGhlName("");
    setGhlDescription("");
    setGhlCalendarId("");
    setGhlMessages([]);
  }

  function openDialog() {
    resetForm();
    setEditIndex(null);
    setSelected(null);
    setStep("select");
    setOpen(true);
  }

  // Preenche o formulário com os dados da ferramenta já salva na Vapi para edição.
  function openEditDialog(tool: VapiTool, index: number) {
    const item = findCatalogItemByVapiType(tool.type);
    if (!item) {
      toast.error("Este tipo de ferramenta não pode ser editado aqui.");
      return;
    }
    resetForm();
    // Built-in tools (endCall etc.) guardam nome/descrição dentro de `function`,
    // pois a Vapi rejeita essas chaves no nível raiz do tool.
    const name =
      typeof tool.name === "string" && tool.name
        ? tool.name
        : typeof tool.function?.name === "string"
          ? tool.function.name
          : "";
    const desc =
      typeof tool.description === "string" && tool.description
        ? tool.description
        : typeof tool.function?.description === "string"
          ? tool.function.description
          : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMessages: any[] = Array.isArray(tool.messages) ? tool.messages : [];
    const simpleMessages: VoicemailMessage[] = rawMessages.map((m) => ({
      type: (m?.type ?? "request-start") as TransferMessageType,
      content: typeof m?.content === "string" ? m.content : "",
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: Record<string, any> =
      tool.metadata && typeof tool.metadata === "object" ? tool.metadata : {};

    switch (item.kind) {
      case "transferCall": {
        if (name) setTcName(name);
        setTcDescription(desc);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dests: any[] = Array.isArray(tool.destinations) ? tool.destinations : [];
        setTcDestinations(
          dests.map((d) => {
            const base: TransferDestinationBase = {
              description: typeof d?.description === "string" ? d.description : "",
              message: typeof d?.message === "string" ? d.message : "",
              mode: (d?.transferPlan?.mode ?? "blind-transfer") as TransferMode,
              warmMessage:
                typeof d?.transferPlan?.message === "string" ? d.transferPlan.message : "",
            };
            return d?.type === "sip"
              ? { type: "sip", sipUri: String(d.sipUri ?? ""), ...base }
              : { type: "number", number: String(d?.number ?? ""), ...base };
          }),
        );
        setTcMessages(
          simpleMessages.map((m) => ({ type: m.type, content: m.content }) as TransferMessage),
        );
        break;
      }
      case "endCall": {
        if (name) setEcName(name);
        setEcDescription(desc);
        setEcMessages(
          rawMessages.map((m) => ({
            type: (m?.type ?? "request-start") as EndCallMessageType,
            mode: (typeof m?.content === "string" && m.content ? "custom" : "none") as EndCallMessageMode,
            content: typeof m?.content === "string" ? m.content : "",
            blocking: m?.blocking === true,
          })),
        );
        break;
      }
      case "voicemail": {
        if (name) setVmName(name);
        setVmDescription(desc);
        setVmScriptMode((metadata.voicemailScriptMode ?? "assistant") as VoicemailScriptMode);
        setVmScriptContent(
          typeof metadata.voicemailScript === "string" ? metadata.voicemailScript : "",
        );
        setVmBeepDetection(metadata.beepDetectionEnabled === true);
        setVmMessages(simpleMessages);
        break;
      }
      case "dtmf": {
        if (name) setDtName(name);
        setDtDescription(desc);
        setDtSipInfo(tool.sipInfoDtmfEnabled === true);
        setDtMessages(simpleMessages);
        break;
      }
      case "sms": {
        if (name) setSmsName(name);
        setSmsDescription(desc);
        setSmsToPreset(typeof metadata.toPreset === "string" ? metadata.toPreset : "");
        setSmsBodyPreset(typeof metadata.bodyPreset === "string" ? metadata.bodyPreset : "");
        setSmsMessages(simpleMessages);
        break;
      }
      case "sipRequest": {
        if (name) setSrName(name);
        if (desc) setSrDescription(desc);
        setSrAsync(tool.async === true);
        setSrStrict(tool.strict === true);
        if (tool.parameters) {
          setSrParamsMode("json");
          setSrParamsJson(JSON.stringify(tool.parameters, null, 2));
        }
        setSrSipVerb((tool.sipVerb ?? "INFO") as "INFO" | "MESSAGE" | "NOTIFY");
        if (typeof tool.body === "string") {
          setSrBodyMode("raw");
          setSrBodyRaw(tool.body);
        }
        setSrMessages(simpleMessages);
        break;
      }
      case "handoff": {
        if (name) setHoName(name);
        setHoDescription(desc);
        setHoAsync(tool.async === true);
        setHoStrict(tool.strict === true);
        if (tool.parameters) {
          setHoParamsMode("json");
          setHoParamsJson(JSON.stringify(tool.parameters, null, 2));
        }
        setHoDestinations(
          (Array.isArray(tool.destinations) ? tool.destinations : []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (d: any) => ({
              assistantId: String(d?.assistantId ?? ""),
              description: typeof d?.description === "string" ? d.description : "",
            }),
          ),
        );
        setHoMessages(simpleMessages);
        break;
      }
      case "query": {
        if (name) setQName(name);
        setQDescription(desc);
        setQKnowledgeBases(
          (Array.isArray(tool.knowledgeBases) ? tool.knowledgeBases : []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (kb: any) => ({ fileId: String(kb?.fileIds?.[0] ?? "") }),
          ),
        );
        setQMessages(simpleMessages);
        break;
      }
      case "apiRequest": {
        setArName(name);
        setArDescription(desc);
        setArUrl(typeof tool.url === "string" ? tool.url : "");
        setArMethod((tool.method ?? "GET") as typeof arMethod);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headerProps: Record<string, any> = tool.headers?.properties ?? {};
        const plainHeaders: Array<{ key: string; value: string }> = [];
        let authType: "none" | "bearer" | "apiKey" | "basic" = "none";
        let authToken = "";
        let authHeaderName = "x-api-key";
        for (const [key, v] of Object.entries(headerProps)) {
          const value = typeof v?.default === "string" ? v.default : "";
          if (key.toLowerCase() === "authorization" && value.startsWith("Bearer ")) {
            authType = "bearer";
            authToken = value.slice(7);
            continue;
          }
          if (key.toLowerCase() === "authorization" && value.startsWith("Basic ")) {
            authType = "basic";
            authToken = value.slice(6);
            continue;
          }
          if (key.toLowerCase() === "x-api-key" || key.toLowerCase() === "api-key") {
            authType = "apiKey";
            authHeaderName = key;
            authToken = value;
            continue;
          }
          plainHeaders.push({ key, value });
        }
        setArHeaders(plainHeaders);
        setArAuthType(authType);
        setArAuthToken(authToken);
        setArAuthHeaderName(authHeaderName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyProps: Record<string, any> = tool.body?.properties ?? {};
        const bodyRequired: string[] = Array.isArray(tool.body?.required) ? tool.body.required : [];
        const statics: Array<{ key: string; value: string }> = [];
        const dynamics: ApiSchemaField[] = [];
        for (const [key, v] of Object.entries(bodyProps)) {
          if (typeof v?.default === "string") {
            statics.push({ key, value: v.default });
          } else {
            dynamics.push({
              key,
              type: (v?.type ?? "string") as ApiSchemaField["type"],
              description: typeof v?.description === "string" ? v.description : "",
              required: bodyRequired.includes(key),
            });
          }
        }
        setArStaticFields(statics);
        setArBodyParams(dynamics);
        setArBodyLocked(tool.body?.additionalProperties === false);
        setArTimeoutSeconds(typeof tool.timeoutSeconds === "number" ? tool.timeoutSeconds : 20);
        setArRetries(typeof tool.backoffPlan?.maxRetries === "number" ? tool.backoffPlan.maxRetries : 0);
        setArBackoffType((tool.backoffPlan?.type ?? "fixed") as "fixed" | "exponential");
        setArBackoffBaseDelay(
          typeof tool.backoffPlan?.baseDelaySeconds === "number"
            ? tool.backoffPlan.baseDelaySeconds * 1000
            : 1000,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const respProps: Record<string, any> = tool.variableExtractionPlan?.schema?.properties ?? {};
        const respRequired: string[] = Array.isArray(tool.variableExtractionPlan?.schema?.required)
          ? tool.variableExtractionPlan.schema.required
          : [];
        setArResponseVars(
          Object.entries(respProps).map(([key, v]) => ({
            key,
            type: (v?.type ?? "string") as ApiSchemaField["type"],
            description: typeof v?.description === "string" ? v.description : "",
            required: respRequired.includes(key),
          })),
        );
        setArAliases(
          (Array.isArray(tool.variableExtractionPlan?.aliases)
            ? tool.variableExtractionPlan.aliases
            : []
          ).map((a: { key?: string; name?: string; value?: string }) => ({
            name: String(a?.key ?? a?.name ?? ""),
            value: String(a?.value ?? ""),
          })),
        );
        setArMessages(simpleMessages);
        break;
      }

      case "mcp": {
        if (name) setMcpName(name);
        setMcpDescription(desc);
        setMcpServerUrl(typeof tool.server?.url === "string" ? tool.server.url : "");
        if (typeof tool.server?.timeoutSeconds === "number") {
          setMcpTimeout(tool.server.timeoutSeconds);
        }
        setMcpHeaders(
          Object.entries(tool.server?.headers ?? {}).map(([key, value]) => ({
            key,
            value: String(value ?? ""),
          })),
        );
        setMcpProtocol((tool.protocol ?? "shttp") as "shttp" | "sse");
        setMcpMessages(simpleMessages);
        break;
      }
      case "slack": {
        if (name) setSlName(name);
        setSlDescription(desc);
        setSlMessages(simpleMessages);
        break;
      }
      case "sheets": {
        if (name) setGsName(name);
        setGsDescription(desc);
        setGsSpreadsheetId(typeof tool.spreadsheetId === "string" ? tool.spreadsheetId : "");
        setGsRange(typeof tool.range === "string" ? tool.range : "");
        setGsMessages(simpleMessages);
        break;
      }
      case "gcalCreate":
      case "gcalCheck": {
        if (name) setGcName(name);
        setGcDescription(desc);
        setGcCalendarId(typeof tool.calendarId === "string" ? tool.calendarId : "");
        setGcTimezone(typeof tool.timezone === "string" ? tool.timezone : "");
        setGcMessages(simpleMessages);
        break;
      }
      case "ghlCalCreate":
      case "ghlCalCheck":
      case "ghlContactCreate":
      case "ghlContactGet": {
        setGhlName(name);
        setGhlDescription(desc);
        setGhlCalendarId(typeof tool.calendarId === "string" ? tool.calendarId : "");
        setGhlMessages(simpleMessages);
        break;
      }
      case "function": {
        setFnName(typeof tool.function?.name === "string" ? tool.function.name : name);
        setFnDescription(
          typeof tool.function?.description === "string" ? tool.function.description : desc,
        );
        setServerUrl(typeof tool.server?.url === "string" ? tool.server.url : "");
        if (tool.function?.parameters) {
          setFnParams(JSON.stringify(tool.function.parameters, null, 2));
        }
        break;
      }
      default:
        break;
    }

    setSelected(item);
    setEditIndex(index);
    setStep("configure");
    setOpen(true);
  }

  function pickItem(item: CatalogItem) {
    setSelected(item);
    setEditIndex(null);
    // Set contextual default name for GHL variants
    if (item.kind === "ghlCalCreate") setGhlName("ghl_calendar_create_event_tool");
    else if (item.kind === "ghlCalCheck") setGhlName("ghl_calendar_check_availability_tool");
    else if (item.kind === "ghlContactCreate") setGhlName("ghl_contact_create_tool");
    else if (item.kind === "ghlContactGet") setGhlName("ghl_contact_get_tool");
    setStep("configure");
  }

  function backToSelect() {
    setStep("select");
    setSelected(null);
    setEditIndex(null);
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
        destinations: tcDestinations.map((d) => {
          const needsWarmMessage =
            d.mode === "warm-transfer-say-message" ||
            d.mode === "warm-transfer-wait-for-operator-to-speak-first-and-then-say-message";
          const transferPlan: Record<string, unknown> = { mode: d.mode };
          if (needsWarmMessage && d.warmMessage.trim()) {
            transferPlan.message = d.warmMessage.trim();
          }
          return {
            ...(d.type === "number"
              ? { type: "number" as const, number: d.number.trim() }
              : { type: "sip" as const, sipUri: d.sipUri.trim() }),
            ...(d.description.trim() ? { description: d.description.trim() } : {}),
            ...(d.message.trim() ? { message: d.message.trim() } : {}),
            transferPlan,
          };
        }),
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
      {
        const props: Record<string, unknown> = {};
        const required: string[] = [];
        const token = arAuthToken.trim();
        if (arAuthType === "bearer" && token) {
          props["Authorization"] = { type: "string", default: `Bearer ${token}` };
          required.push("Authorization");
        } else if (arAuthType === "basic" && token) {
          props["Authorization"] = { type: "string", default: `Basic ${token}` };
          required.push("Authorization");
        } else if (arAuthType === "apiKey" && token) {
          const hn = arAuthHeaderName.trim() || "x-api-key";
          props[hn] = { type: "string", default: token };
          required.push(hn);
        }
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
      {
        const props: Record<string, unknown> = {};
        const required: string[] = [];
        for (const f of arBodyParams) {
          const k = f.key.trim();
          if (!k) continue;
          props[k] = {
            type: f.type,
            ...(f.description.trim() ? { description: f.description.trim() } : {}),
          };
          if (f.required) required.push(k);
        }
        for (const f of arStaticFields) {
          const k = f.key.trim();
          if (!k) continue;
          props[k] = { type: "string", ...(f.value.trim() ? { default: f.value.trim() } : {}) };
          if (!required.includes(k)) required.push(k);
        }
        if (Object.keys(props).length > 0) {
          tool.body = {
            type: "object",
            properties: props,
            required,
            ...(arBodyLocked ? { additionalProperties: false } : {}),
          };
        }
      }
      {
        const props: Record<string, unknown> = {};
        const required: string[] = [];
        for (const f of arResponseVars) {
          const k = f.key.trim();
          if (!k) continue;
          props[k] = {
            type: f.type,
            ...(f.description.trim() ? { description: f.description.trim() } : {}),
          };
          if (f.required) required.push(k);
        }
        const aliases = arAliases
          .filter((a) => a.name.trim() && a.value.trim())
          .map((a) => ({ key: a.name.trim(), value: a.value.trim() }));
        if (Object.keys(props).length > 0 || aliases.length > 0) {
          tool.variableExtractionPlan = {
            ...(Object.keys(props).length > 0
              ? { schema: { type: "object", properties: props, required } }
              : {}),
            ...(aliases.length > 0 ? { aliases } : {}),
          };
        }
      }
      if (arTimeoutSeconds > 0) tool.timeoutSeconds = arTimeoutSeconds;
      if (arRetries > 0) {
        tool.backoffPlan = {
          type: arBackoffType,
          maxRetries: arRetries,
          baseDelaySeconds: Math.max(1, Math.round(arBackoffBaseDelay / 1000)),
        };
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
    if (selected.kind === "sheets") {
      const spreadsheetId = gsSpreadsheetId.trim();
      const range = gsRange.trim();
      if (!spreadsheetId) {
        toast.error("Spreadsheet ID é obrigatório.");
        return null;
      }
      if (!range) {
        toast.error("Range é obrigatório.");
        return null;
      }
      const name = gsName.trim() || "google_sheets_tool";
      const tool: VapiTool = {
        type: "google.sheets.row.append",
        name,
        spreadsheetId,
        range,
      };
      if (gsDescription.trim()) tool.description = gsDescription.trim();
      if (gsMessages.length > 0) {
        tool.messages = gsMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (selected.kind === "gcalCreate" || selected.kind === "gcalCheck") {
      const name = gcName.trim() || "google_calendar_tool";
      const type =
        selected.kind === "gcalCreate"
          ? "google.calendar.createEvent"
          : "google.calendar.checkAvailability";
      const tool: VapiTool = { type, name };
      if (gcDescription.trim()) tool.description = gcDescription.trim();
      if (gcCalendarId.trim()) tool.calendarId = gcCalendarId.trim();
      if (gcTimezone.trim()) tool.timezone = gcTimezone.trim();
      if (gcMessages.length > 0) {
        tool.messages = gcMessages.map((m) => ({ type: m.type, content: m.content }));
      }
      return tool;
    }
    if (
      selected.kind === "ghlCalCreate" ||
      selected.kind === "ghlCalCheck" ||
      selected.kind === "ghlContactCreate" ||
      selected.kind === "ghlContactGet"
    ) {
      const typeMap = {
        ghlCalCreate: "gohighlevel.calendar.event.create",
        ghlCalCheck: "gohighlevel.calendar.availability.check",
        ghlContactCreate: "gohighlevel.contact.create",
        ghlContactGet: "gohighlevel.contact.get",
      } as const;
      const isCalendar = selected.kind === "ghlCalCreate" || selected.kind === "ghlCalCheck";
      const name = ghlName.trim() || "ghl_tool";
      if (isCalendar && !ghlCalendarId.trim()) {
        toast.error("Calendar ID é obrigatório para ferramentas de calendário do GoHighLevel.");
        return null;
      }
      const tool: VapiTool = { type: typeMap[selected.kind as keyof typeof typeMap], name };
      if (ghlDescription.trim()) tool.description = ghlDescription.trim();
      if (isCalendar) tool.calendarId = ghlCalendarId.trim();
      if (ghlMessages.length > 0) {
        tool.messages = ghlMessages.map((m) => ({ type: m.type, content: m.content }));
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
    const isEditing = editIndex !== null;
    setIsSubmitting(true);
    try {
      const nextTools = isEditing
        ? tools.map((t, i) => (i === editIndex ? newTool : t))
        : [...tools, newTool];
      await saveConfig({ data: { id, tools: nextTools } });
      onToolsChange(nextTools);
      toast.success(isEditing ? "Ferramenta atualizada." : "Ferramenta adicionada.");
      setOpen(false);
      backToSelect();
    } catch (err) {
      console.error(err);
      toast.error(isEditing ? "Erro ao atualizar ferramenta." : "Erro ao adicionar ferramenta.");
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

  // A Vapi nunca transfere "sozinha": o modelo precisa decidir chamar a tool.
  // Esta função gera a regra em texto e injeta no System Prompt, que é o que
  // realmente faz a transferência acontecer durante a ligação.
  function buildTransferPromptRule(tool: VapiTool): string {
    const destinations = Array.isArray(tool.destinations) ? tool.destinations : [];
    const lines = destinations.map((d) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dest = d as any;
      const target = dest.type === "sip" ? dest.sipUri : dest.number;
      const when = dest.description?.trim() || "o cliente pedir para falar com um atendente humano";
      const say = dest.message?.trim();
      return `- Se ${when}, transfira a ligação para ${target} usando a ferramenta "${tool.name ?? "transferCall"}".${
        say ? ` Antes de transferir, diga: "${say}".` : ""
      }`;
    });
    return [
      "## Regras de transferência",
      ...lines,
      "Nunca invente números: use apenas os destinos configurados. Se nenhuma condição acima for atendida, continue o atendimento normalmente.",
    ].join("\n");
  }

  async function handleInsertPromptRule(tool: VapiTool) {
    const rule = buildTransferPromptRule(tool);
    if (systemPrompt.includes("## Regras de transferência")) {
      toast.info("O prompt já contém uma seção de regras de transferência.", {
        description: "Edite manualmente na aba Assistente para evitar regras duplicadas.",
      });
      return;
    }
    const next = systemPrompt.trim() ? `${systemPrompt.trim()}\n\n${rule}` : rule;
    setIsInsertingRule(true);
    try {
      await saveConfig({ data: { id, systemPrompt: next } });
      onSystemPromptChange(next);
      toast.success("Regra inserida no System Prompt.", {
        description: "O assistente agora sabe quando acionar a transferência.",
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao inserir a regra no prompt.", {
        description: err instanceof Error ? err.message.slice(0, 300) : undefined,
      });
    } finally {
      setIsInsertingRule(false);
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
              role="button"
              tabIndex={0}
              onClick={() => openEditDialog(tool, index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openEditDialog(tool, index);
                }
              }}
              className="group relative cursor-pointer overflow-hidden border-white/[0.08] bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30"
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
                  <div className="flex items-center gap-1">
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Editar
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(index);
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir ferramenta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {toolTitle(tool)}
                  </p>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                </div>
                {tool.type === "transferCall" && (
                  <div className="space-y-2 rounded-lg border border-white/[0.06] bg-background/30 p-3">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      A IA só transfere quando o System Prompt diz em quais situações fazer isso.
                      Insira a regra automaticamente:
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isInsertingRule}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInsertPromptRule(tool);
                      }}
                      className="h-7 w-full gap-1.5 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                    >
                      <Sparkles className="h-3 w-3" />
                      {isInsertingRule ? "Inserindo..." : "Inserir regra no prompt"}
                    </Button>
                  </div>
                )}
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
                        const buttonInner = (
                          <>
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
                            {item.beta && (
                              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                Beta
                              </span>
                            )}
                            {item.locked && (
                              <span className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <Lock className="h-3 w-3" />
                                Bloqueado
                              </span>
                            )}
                            {item.kind === "comingSoon" && (
                              <span className="rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                Em breve
                              </span>
                            )}
                            {item.subItems && !item.locked && (
                              <span className="rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {item.subItems.length} opções
                              </span>
                            )}
                          </>
                        );
                        const btnClass = "group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-background/30 p-3 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-background/50";
                        if (item.locked) {
                          return (
                            <div
                              key={item.key}
                              aria-disabled
                              title="Em desenvolvimento — disponível em breve"
                              className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-white/[0.06] bg-background/20 p-3 text-left opacity-50 backdrop-blur-xl"
                            >
                              {buttonInner}
                            </div>
                          );
                        }
                        if (item.subItems && item.subItems.length > 0) {
                          return (
                            <DropdownMenu key={item.key}>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className={btnClass}>
                                  {buttonInner}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-72 border-white/[0.08] bg-card/95 backdrop-blur-2xl">
                                {item.subItems.map((sub) => {
                                  const SubIcon = sub.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={sub.key}
                                      disabled={sub.locked}
                                      onClick={() => pickItem(sub)}
                                      className="gap-3 py-2"
                                    >
                                      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", sub.iconBg, sub.iconColor)}>
                                        <SubIcon className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground">{sub.label}</p>
                                        <p className="truncate text-xs text-muted-foreground">{sub.description}</p>
                                      </div>
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        }
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => pickItem(item)}
                            className={btnClass}
                          >
                            {buttonInner}
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
                {editIndex === null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={backToSelect}
                    className="mb-2 -ml-2 h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar
                  </Button>
                )}
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
                      {editIndex !== null ? "Editar: " : ""}
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

                      <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2.5 text-[11px] leading-relaxed text-amber-300/90">
                        A Vapi não permite transferir chamadas de teste no navegador para números de
                        telefone — a sala é encerrada assim que a IA aciona a transferência. Valide
                        a transferência ligando de um telefone real, usando um número da aba
                        Telefonia.
                      </p>
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
                                setTcDestinations((p) => [
                                  ...p,
                                  { type: "number", number: "", ...EMPTY_TRANSFER_FIELDS },
                                ])
                              }
                            >
                              <Phone className="mr-2 h-3.5 w-3.5" />
                              Phone Number
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setTcDestinations((p) => [
                                  ...p,
                                  { type: "sip", sipUri: "", ...EMPTY_TRANSFER_FIELDS },
                                ])
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
                        <div className="space-y-3">
                          {tcDestinations.map((d, idx) => {
                            const patch = (fields: Partial<TransferDestination>) =>
                              setTcDestinations((prev) =>
                                prev.map((it, i) =>
                                  i !== idx ? it : ({ ...it, ...fields } as TransferDestination),
                                ),
                              );
                            const needsWarmMessage =
                              d.mode === "warm-transfer-say-message" ||
                              d.mode ===
                                "warm-transfer-wait-for-operator-to-speak-first-and-then-say-message";
                            return (
                              <div
                                key={idx}
                                className="space-y-3 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {d.type === "number" ? "Phone" : "SIP"}
                                  </span>
                                  {d.type === "number" ? (
                                    <PhoneNumberInput
                                      value={d.number}
                                      onChange={(val) => patch({ number: val } as Partial<TransferDestination>)}
                                      className="flex-1"
                                    />
                                  ) : (
                                    <Input
                                      value={d.sipUri}
                                      onChange={(e) =>
                                        patch({ sipUri: e.target.value } as Partial<TransferDestination>)
                                      }
                                      placeholder="sip:user@domain.com"
                                      className="h-8 border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                                    />
                                  )}
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

                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-medium text-muted-foreground">
                                    Quando transferir (condição)
                                  </Label>
                                  <Textarea
                                    value={d.description}
                                    onChange={(e) => patch({ description: e.target.value })}
                                    rows={2}
                                    placeholder="Ex.: quando o cliente pedir para falar com um humano, ou quando perguntar sobre cobrança/financeiro."
                                    className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                                  />
                                  <p className="text-[10px] text-muted-foreground/70">
                                    É esta descrição que a IA usa para decidir sozinha quando chamar a
                                    transferência. Sem ela, a transferência nunca dispara.
                                  </p>
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-medium text-muted-foreground">
                                    Mensagem ao cliente antes de transferir
                                  </Label>
                                  <Input
                                    value={d.message}
                                    onChange={(e) => patch({ message: e.target.value })}
                                    placeholder="Só um momento, vou te transferir para um especialista."
                                    className="h-8 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                                  />
                                  <p className="text-[10px] text-muted-foreground/70">
                                    É exatamente esta frase que a IA fala em voz alta antes de
                                    encaminhar a ligação para este destino.
                                  </p>
                                </div>


                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-medium text-muted-foreground">
                                    Modo de transferência
                                  </Label>
                                  <Select
                                    value={d.mode}
                                    onValueChange={(v) => patch({ mode: v as TransferMode })}
                                  >
                                    <SelectTrigger className="h-8 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                                      {TRANSFER_MODE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-[10px] text-muted-foreground/70">
                                    {TRANSFER_MODE_OPTIONS.find((o) => o.value === d.mode)?.hint}
                                  </p>
                                </div>

                                {needsWarmMessage && (
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-medium text-muted-foreground">
                                      Mensagem para quem recebe a ligação
                                    </Label>
                                    <Input
                                      value={d.warmMessage}
                                      onChange={(e) => patch({ warmMessage: e.target.value })}
                                      placeholder="Olá, estou passando um cliente interessado no plano premium."
                                      className="h-8 border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                        <Label htmlFor="ec-name" className="text-xs">Nome da ferramenta</Label>
                        <Input
                          id="ec-name"
                          value={ecName}
                          onChange={(e) => setEcName(e.target.value)}
                          placeholder="finalizar_chamada"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Somente letras, números, hífen e underline (máx. 64 caracteres).
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ec-desc" className="text-xs">Quando encerrar a chamada</Label>
                        <Textarea
                          id="ec-desc"
                          rows={3}
                          maxLength={1000}
                          value={ecDescription}
                          onChange={(e) => setEcDescription(e.target.value)}
                          placeholder="Ex.: encerre a ligação quando o cliente se despedir, disser que não tem interesse ou quando o atendimento for concluído."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Esta é a condição que a IA avalia para chamar a ferramenta. Sem ela, o
                          modelo raramente desliga sozinho.
                        </p>
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
                            <p className="text-[11px] text-muted-foreground">Configure a autenticação enviada no header da requisição.</p>
                            <Select value={arAuthType} onValueChange={(v) => setArAuthType(v as typeof arAuthType)}>
                              <SelectTrigger className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem autenticação</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                                <SelectItem value="apiKey">API Key (header)</SelectItem>
                                <SelectItem value="basic">Basic (base64)</SelectItem>
                              </SelectContent>
                            </Select>
                            {arAuthType === "apiKey" && (
                              <Input
                                value={arAuthHeaderName}
                                onChange={(e) => setArAuthHeaderName(e.target.value)}
                                placeholder="x-api-key"
                                className="border-white/[0.08] bg-background/40 font-mono text-xs"
                              />
                            )}
                            {arAuthType !== "none" && (
                              <Input
                                value={arAuthToken}
                                onChange={(e) => setArAuthToken(e.target.value)}
                                placeholder={arAuthType === "basic" ? "base64(user:senha)" : "Token / chave"}
                                className="border-white/[0.08] bg-background/40 font-mono text-xs"
                              />
                            )}
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
                          <p className="text-[11px] text-muted-foreground">
                            Propriedades que a IA preenche em tempo real e envia no corpo da requisição.
                          </p>
                          <ApiSchemaFieldsEditor
                            fields={arBodyParams}
                            onChange={setArBodyParams}
                            emptyLabel="Nenhum parâmetro definido."
                            addLabel="Add Property"
                          />

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

                      <AccordionItem value="settings" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Timeout &amp; Retries
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Timeout (segundos)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={300}
                              value={arTimeoutSeconds}
                              onChange={(e) => setArTimeoutSeconds(Number(e.target.value) || 0)}
                              className="border-white/[0.08] bg-background/40 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Máximo de tentativas (retries)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={10}
                              value={arRetries}
                              onChange={(e) => setArRetries(Number(e.target.value) || 0)}
                              className="border-white/[0.08] bg-background/40 text-xs"
                            />
                          </div>
                          {arRetries > 0 && (
                            <>
                              <div className="space-y-2">
                                <Label className="text-xs">Estratégia de backoff</Label>
                                <Select value={arBackoffType} onValueChange={(v) => setArBackoffType(v as typeof arBackoffType)}>
                                  <SelectTrigger className="border-white/[0.08] bg-background/40 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed">Fixed</SelectItem>
                                    <SelectItem value="exponential">Exponential</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Delay base (ms)</Label>
                                <Input
                                  type="number"
                                  min={1000}
                                  step={1000}
                                  value={arBackoffBaseDelay}
                                  onChange={(e) => setArBackoffBaseDelay(Number(e.target.value) || 1000)}
                                  className="border-white/[0.08] bg-background/40 text-xs"
                                />
                              </div>
                            </>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="response" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Response Body
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <p className="text-[11px] text-muted-foreground">
                            Variáveis extraídas da resposta da API e disponibilizadas para a IA.
                          </p>
                          <ApiSchemaFieldsEditor
                            fields={arResponseVars}
                            onChange={setArResponseVars}
                            emptyLabel="Nenhuma variável de resposta definida."
                            addLabel="Add Property"
                          />
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="aliases" className="rounded-xl border border-white/[0.08] bg-background/30 px-4 backdrop-blur-xl">
                        <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline">
                          Aliases
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <p className="text-[11px] text-muted-foreground">
                            Crie nomes simples para caminhos da resposta (ex.: <code>{"{{ output.data.name }}"}</code>).
                          </p>
                          {arAliases.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-[11px] text-muted-foreground">
                              Nenhum alias configurado.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {arAliases.map((a, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    value={a.name}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\s+/g, "");
                                      setArAliases((prev) => prev.map((it, i) => (i === idx ? { ...it, name: val } : it)));
                                    }}
                                    placeholder="nomeDoAlias"
                                    className="border-white/[0.08] bg-background/40 font-mono text-xs"
                                  />
                                  <Input
                                    value={a.value}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setArAliases((prev) => prev.map((it, i) => (i === idx ? { ...it, value: val } : it)));
                                    }}
                                    placeholder="{{ output.data.name }}"
                                    className="border-white/[0.08] bg-background/40 font-mono text-xs"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setArAliases((prev) => prev.filter((_, i) => i !== idx))}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    aria-label="Remover alias"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setArAliases((p) => [...p, { name: "", value: "" }])}
                            className="h-7 gap-1 border-white/[0.08] bg-background/40 text-xs"
                          >
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

                {selected?.kind === "sheets" && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Tool Settings</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gs-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="gs-name"
                          value={gsName}
                          onChange={(e) => setGsName(e.target.value)}
                          placeholder="google_sheets_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gs-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="gs-desc"
                          rows={3}
                          maxLength={1000}
                          value={gsDescription}
                          onChange={(e) => setGsDescription(e.target.value)}
                          placeholder="Explique quando a IA deve adicionar linhas à planilha."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">{gsDescription.length}/1000</p>
                      </div>
                    </div>

                    {/* Panel 2 — Google Sheets Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-start gap-2">
                        <Sheet className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Google Sheets Settings</h3>
                          <p className="text-[11px] text-muted-foreground">Configure the Google Sheet and range for this tool</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gs-sid" className="text-xs">
                          Spreadsheet ID <span className="text-rose-400">*</span>
                        </Label>
                        <Input
                          id="gs-sid"
                          value={gsSpreadsheetId}
                          onChange={(e) => setGsSpreadsheetId(e.target.value)}
                          placeholder="Enter Spreadsheet ID"
                          className={cn(
                            "border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl",
                            !gsSpreadsheetId.trim() && "border-rose-500/40",
                          )}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          The ID of the Google Sheet to append data to
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gs-range" className="text-xs">
                          Range <span className="text-rose-400">*</span>
                        </Label>
                        <Input
                          id="gs-range"
                          value={gsRange}
                          onChange={(e) => setGsRange(e.target.value)}
                          placeholder="Enter Range (e.g., Sheet1!A:Z)"
                          className={cn(
                            "border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl",
                            !gsRange.trim() && "border-rose-500/40",
                          )}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          The range where the data should be appended (e.g., Sheet1, Sheet1!A:Z)
                        </p>
                      </div>
                    </div>

                    {/* Panel 3 — Messages */}
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
                                onClick={() => setGsMessages((p) => [...p, { type: t, content: "" }])}
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {gsMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {gsMessages.map((m, idx) => (
                            <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setGsMessages((prev) => prev.filter((_, i) => i !== idx))}
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
                                  setGsMessages((prev) => prev.map((it, i) => (i === idx ? { ...it, content: val } : it)));
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

                {(selected?.kind === "gcalCreate" || selected?.kind === "gcalCheck") && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Tool Settings</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gc-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="gc-name"
                          value={gcName}
                          onChange={(e) => setGcName(e.target.value)}
                          placeholder="google_calendar_tool"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gc-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="gc-desc"
                          rows={3}
                          maxLength={1000}
                          value={gcDescription}
                          onChange={(e) => setGcDescription(e.target.value)}
                          placeholder={
                            selected?.kind === "gcalCreate"
                              ? "Explique quando a IA deve criar eventos na agenda."
                              : "Explique quando a IA deve verificar disponibilidade na agenda."
                          }
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">{gcDescription.length}/1000</p>
                      </div>
                    </div>

                    {/* Panel 2 — Calendar Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Calendar Settings</h3>
                          <p className="text-[11px] text-muted-foreground">
                            {selected?.kind === "gcalCreate"
                              ? "Configure the Google Calendar for event creation"
                              : "Configure the Google Calendar for availability check"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gc-cid" className="text-xs">Calendar ID</Label>
                        <Input
                          id="gc-cid"
                          value={gcCalendarId}
                          onChange={(e) => setGcCalendarId(e.target.value)}
                          placeholder="Enter Calendar ID"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          The ID of the Google Calendar. Defaults to 'primary' if not specified.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gc-tz" className="text-xs">Timezone</Label>
                        <Input
                          id="gc-tz"
                          value={gcTimezone}
                          onChange={(e) => setGcTimezone(e.target.value)}
                          placeholder="America/New_York"
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          The time zone for the calendar event (e.g., America/New_York). Defaults to UTC if not specified.
                        </p>
                      </div>
                    </div>

                    {/* Panel 3 — Messages */}
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
                                onClick={() => setGcMessages((p) => [...p, { type: t, content: "" }])}
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {gcMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {gcMessages.map((m, idx) => (
                            <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setGcMessages((prev) => prev.filter((_, i) => i !== idx))}
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
                                  setGcMessages((prev) => prev.map((it, i) => (i === idx ? { ...it, content: val } : it)));
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

                {(selected?.kind === "ghlCalCreate" ||
                  selected?.kind === "ghlCalCheck" ||
                  selected?.kind === "ghlContactCreate" ||
                  selected?.kind === "ghlContactGet") && (
                  <div className="space-y-4">
                    {/* Panel 1 — Tool Settings */}
                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Tool Settings</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ghl-name" className="text-xs">Tool Name</Label>
                        <Input
                          id="ghl-name"
                          value={ghlName}
                          onChange={(e) => setGhlName(e.target.value)}
                          placeholder={
                            selected?.kind === "ghlCalCreate"
                              ? "ghl_calendar_create_event_tool"
                              : selected?.kind === "ghlCalCheck"
                                ? "ghl_calendar_check_availability_tool"
                                : selected?.kind === "ghlContactCreate"
                                  ? "ghl_contact_create_tool"
                                  : "ghl_contact_get_tool"
                          }
                          className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ghl-desc" className="text-xs">Description</Label>
                        <Textarea
                          id="ghl-desc"
                          rows={3}
                          maxLength={1000}
                          value={ghlDescription}
                          onChange={(e) => setGhlDescription(e.target.value)}
                          placeholder="Descreva quando a IA deve usar esta ferramenta do GoHighLevel."
                          className="border-white/[0.08] bg-background/40 text-xs backdrop-blur-xl"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">{ghlDescription.length}/1000</p>
                      </div>
                    </div>

                    {/* Panel 2 — Calendar Settings (only for calendar variants) */}
                    {(selected?.kind === "ghlCalCreate" || selected?.kind === "ghlCalCheck") && (
                      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-background/30 p-4 backdrop-blur-xl">
                        <div className="flex items-start gap-2">
                          <Calendar className="mt-0.5 h-3.5 w-3.5 text-orange-500" />
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Calendar Settings</h3>
                            <p className="text-[11px] text-muted-foreground">
                              {selected?.kind === "ghlCalCreate"
                                ? "Configure the GoHighLevel calendar for event creation"
                                : "Configure the GoHighLevel calendar for availability check"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ghl-cid" className="text-xs">Calendar ID *</Label>
                          <Input
                            id="ghl-cid"
                            value={ghlCalendarId}
                            onChange={(e) => setGhlCalendarId(e.target.value)}
                            placeholder="Enter Calendar ID"
                            className="border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            The ID of the GoHighLevel Calendar.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Panel 3 — Messages */}
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
                                onClick={() => setGhlMessages((p) => [...p, { type: t, content: "" }])}
                              >
                                {TRANSFER_MESSAGE_LABELS[t]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {ghlMessages.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/[0.08] bg-background/20 px-4 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma mensagem definida.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {ghlMessages.map((m, idx) => (
                            <div key={idx} className="space-y-2 rounded-lg border border-white/[0.06] bg-background/40 p-3 backdrop-blur-xl">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-foreground">
                                  {TRANSFER_MESSAGE_LABELS[m.type]}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setGhlMessages((prev) => prev.filter((_, i) => i !== idx))}
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
                                  setGhlMessages((prev) => prev.map((it, i) => (i === idx ? { ...it, content: val } : it)));
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

const COST_COLORS = ["#a78bfa", "#60a5fa", "#f472b6", "#fbbf24", "#34d399"];

function AnalyticsPanel({ assistantId }: { assistantId: string }) {
  const [rangeDays, setRangeDays] = useState(7);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["vapi", "assistantAnalytics", assistantId, rangeDays],
    queryFn: () => getAssistantAnalytics({ data: { assistantId, rangeDays } }),
    staleTime: 60_000,
  });

  const empty = {
    totals: { count: 0, minutes: 0, cost: 0 },
    daily: [] as Array<{ date: string; count: number; minutes: number; cost: number }>,
    endedReasons: [] as Array<{ reason: string; count: number }>,
    success: [] as Array<{ label: string; count: number }>,
    costBreakdown: { stt: 0, llm: 0, tts: 0, vapi: 0, transport: 0 },
    error: null as string | null,
  };
  const a = data ?? empty;
  const avgCostPerMin = a.totals.minutes > 0 ? a.totals.cost / a.totals.minutes : 0;

  const costData = [
    { name: "STT", value: a.costBreakdown.stt },
    { name: "LLM", value: a.costBreakdown.llm },
    { name: "TTS", value: a.costBreakdown.tts },
    { name: "Vapi", value: a.costBreakdown.vapi },
    { name: "Transport", value: a.costBreakdown.transport },
  ].filter((d) => d.value > 0);

  const dailyChart = a.daily.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <div className="space-y-4">
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Métricas do assistente</h2>
            <p className="text-xs text-muted-foreground">
              Dados oficiais da API <span className="font-mono">POST /analytics</span> da Vapi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
              <SelectTrigger className="h-8 w-32 border-white/[0.08] bg-background/40 backdrop-blur-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-card/90 backdrop-blur-2xl">
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {a.error && (
        <Card className="border-rose-500/20 bg-rose-500/10">
          <CardContent className="p-4 text-xs text-rose-200">
            Não foi possível carregar as métricas: {a.error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Ligações", value: isLoading ? null : a.totals.count.toLocaleString("pt-BR") },
          { label: "Minutos", value: isLoading ? null : a.totals.minutes.toFixed(1) },
          { label: "Custo total", value: isLoading ? null : `$${a.totals.cost.toFixed(2)}` },
          { label: "Custo médio/min", value: isLoading ? null : `$${avgCostPerMin.toFixed(3)}` },
        ].map((k) => (
          <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
              {k.value === null ? (
                <Skeleton className="mt-2 h-6 w-20" />
              ) : (
                <p className="mt-1 text-xl font-semibold text-foreground">{k.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardContent className="space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Volume por dia</h3>
              <p className="text-[11px] text-muted-foreground">Quantidade de ligações por dia no período.</p>
            </div>
            <div className="h-56">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : dailyChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sem ligações no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{
                        background: "rgba(15,15,20,0.9)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardContent className="space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Custo por componente</h3>
              <p className="text-[11px] text-muted-foreground">Distribuição do custo total agregada pela Vapi.</p>
            </div>
            <div className="h-56">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : costData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sem custos no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={72} paddingAngle={2}>
                      {costData.map((_, i) => (
                        <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <RTooltip
                      formatter={(v: number) => `$${v.toFixed(3)}`}
                      contentStyle={{
                        background: "rgba(15,15,20,0.9)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-foreground">Motivos de término</h3>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : a.endedReasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nada para mostrar ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {a.endedReasons.map((r) => (
                  <div key={r.reason} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-background/30 px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px]", endedReasonBadgeClass(r.reason))}>
                      {r.reason}
                    </span>
                    <span className="text-xs font-medium text-foreground">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-foreground">Avaliação de sucesso</h3>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : a.success.length === 0 ? (
              <p className="text-xs text-muted-foreground">Configure "Critério de Sucesso" abaixo para começar a coletar avaliações.</p>
            ) : (
              <div className="space-y-1.5">
                {a.success.map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-background/30 px-3 py-2">
                    <span className="text-xs text-foreground">{s.label}</span>
                    <span className="text-xs font-medium text-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalysisTab({ assistantId }: { assistantId: string }) {
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monitorsOpen, setMonitorsOpen] = useState(true);

  const loadSchema = useServerFn(getAssistantStructuredSchema);
  const saveSchema = useServerFn(updateAssistantStructuredSchema);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await loadSchema({ data: { assistantId } });
        if (cancelled) return;
        setFields(
          r.fields.map((f, i) => ({
            id: `f${i}-${f.name}`,
            name: f.name,
            type: f.type,
            description: f.description,
          })),
        );
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assistantId, loadSchema]);

  async function persist(next: SchemaField[]) {
    setSavingAll(true);
    try {
      await saveSchema({
        data: {
          assistantId,
          fields: next.map((f) => ({
            name: f.name,
            type: f.type,
            description: f.description,
          })),
        },
      });
      setDirty({});
      toast.success("Structured Outputs salvos na Vapi.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar na Vapi.");
    } finally {
      setSavingAll(false);
    }
  }

  function addField() {
    setFields((prev) => {
      const id = `f${Date.now()}`;
      setDirty((d) => ({ ...d, [id]: true }));
      return [...prev, { id, name: "", type: "string", description: "" }];
    });
  }
  function updateField(id: string, patch: Partial<SchemaField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setDirty((d) => ({ ...d, [id]: true }));
  }
  async function confirmField(id: string) {
    const target = fields.find((f) => f.id === id);
    if (!target || !target.name.trim()) {
      toast.error("Informe um nome para o campo.");
      return;
    }
    await persist(fields);
  }
  async function removeField(id: string) {
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    setDirty((d) => {
      const { [id]: _drop, ...rest } = d;
      return rest;
    });
    await persist(next);
  }

  return (
    <div className="space-y-6">
      {/* Structured Outputs */}
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Structured Outputs</h2>
              <p className="text-xs text-muted-foreground">
                Extraia campos das chamadas para relatórios, automações e scorecards.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addField}
              className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Field
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-background/20 p-10 text-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Carregando campos da Vapi…</span>
            </div>
          ) : fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-background/20 p-10 text-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nenhum campo sendo extraído ainda</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Crie um structured output para capturar detalhes da ligação como status de agendamento,
                informações do cliente ou serviços solicitados.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_140px_1.5fr_80px] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground md:grid">
                <span>Nome do campo</span>
                <span>Tipo</span>
                <span>Descrição</span>
                <span />
              </div>
              {fields.map((field) => {
                const isDirty = !!dirty[field.id];
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-white/[0.06] bg-background/30 p-3 backdrop-blur-xl md:grid-cols-[1fr_140px_1.5fr_80px]"
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => confirmField(field.id)}
                        disabled={savingAll || !field.name.trim()}
                        aria-label="Salvar campo"
                        title={isDirty ? "Salvar alterações na Vapi" : "Sincronizar com a Vapi"}
                        className={cn(
                          "h-9 w-9 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300",
                          isDirty && "ring-2 ring-emerald-500/40",
                        )}
                      >
                        {savingAll ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeField(field.id)}
                        disabled={savingAll}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        aria-label="Remover campo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scorecard */}
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Scorecard</h2>
            <p className="text-xs text-muted-foreground">
              Avalie chamadas automaticamente usando structured outputs booleanos ou numéricos.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Anexe um scorecard para pontuar as chamadas com base nos structured outputs deste assistente.
          </p>

          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-white/[0.1] bg-background/20 p-4 text-left transition hover:bg-background/30"
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-sm font-semibold text-foreground">Criar novo scorecard</span>
            </div>
            <div className="mt-1 flex items-center gap-1 pl-3.5 text-xs text-muted-foreground">
              <Plus className="h-3 w-3" /> Novo
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Attached Monitors */}
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <Collapsible open={monitorsOpen} onOpenChange={setMonitorsOpen}>
          <CardContent className="space-y-4 p-6">
            <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 text-left">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Monitores Anexados</h2>
                <p className="text-xs text-muted-foreground">
                  Supervisione o desempenho das ligações do agente em múltiplas categorias.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  monitorsOpen && "rotate-180",
                )}
              />
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full gap-2 border-white/[0.08] bg-background/30 backdrop-blur-xl"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar monitor
              </Button>
              <div className="rounded-xl border border-white/[0.06] bg-background/20 p-6 text-center text-xs text-muted-foreground">
                Nenhum monitor anexado a este assistente
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
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
