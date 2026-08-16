import { useMemo, useRef, useState } from "react";
import { translateError } from "@/lib/error-messages";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Megaphone,
  Upload,
  FileSpreadsheet,
  Loader2,
  Play,
  Square,
  Trash2,
  Users,
  PhoneOutgoing,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  listVapiCampaigns,
  createVapiCampaign,
  endVapiCampaign,
  deleteVapiCampaign,
  listVapiAssistants,
  listVapiPhoneNumbers,
  listCampaignCalls,
  type VapiCampaignDTO,
} from "@/lib/vapi.functions";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas de Ligação — Omniasyn" },
      {
        name: "description",
        content:
          "Suba uma lista CSV de contatos, escolha a assistente e o número de origem e dispare campanhas de ligações automáticas.",
      },
      { property: "og:title", content: "Campanhas de Ligação — Omniasyn" },
      {
        property: "og:description",
        content: "Importe contatos por CSV e dispare ligações automáticas com sua assistente de voz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampanhasPage,
});

// --- CSV helpers ------------------------------------------------------------

interface CsvRow {
  number: string;
  name?: string;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (hasPlus) return `+${digits}`;
  // Sem código de país: assume Brasil.
  if (digits.length <= 11) return `+55${digits}`;
  return `+${digits}`;
}

interface ParsedCsv {
  rows: CsvRow[];
  invalid: number;
  columns: string[];
}

function parseCsv(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], invalid: 0, columns: [] };

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const first = splitCsvLine(lines[0], delimiter);
  const headerLooksLikeText = first.some((c) =>
    /(numero|número|telefone|phone|number|celular|nome|name)/i.test(c),
  );

  let numberIdx = 0;
  let nameIdx = -1;
  let start = 0;
  let columns: string[] = [];

  if (headerLooksLikeText) {
    columns = first;
    start = 1;
    const findIdx = (re: RegExp) => first.findIndex((c) => re.test(c));
    const n = findIdx(/(numero|número|telefone|phone|number|celular)/i);
    const nm = findIdx(/(nome|name)/i);
    numberIdx = n >= 0 ? n : 0;
    nameIdx = nm >= 0 && nm !== numberIdx ? nm : -1;
  } else {
    columns = first.map((_, i) => `Coluna ${i + 1}`);
    // Heurística: coluna com mais dígitos é o telefone.
    numberIdx = first.findIndex((c) => c.replace(/\D/g, "").length >= 8);
    if (numberIdx < 0) numberIdx = 0;
    nameIdx = first.findIndex((c, i) => i !== numberIdx && /[a-zA-ZÀ-ú]/.test(c));
  }

  const rows: CsvRow[] = [];
  let invalid = 0;
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    const number = normalizePhone(cells[numberIdx] ?? "");
    if (!number || seen.has(number)) {
      if (!number) invalid++;
      continue;
    }
    seen.add(number);
    const name = nameIdx >= 0 ? (cells[nameIdx] ?? "").slice(0, 120) : "";
    rows.push({ number, ...(name ? { name } : {}) });
  }

  return { rows, invalid, columns };
}

// --- Status helpers ---------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  "in-progress": "Em andamento",
  ended: "Finalizada",
};

const STATUS_CLASS: Record<string, string> = {
  scheduled: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  "in-progress": "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  ended: "border-border bg-muted/40 text-muted-foreground",
};

function campaignProgress(c: VapiCampaignDTO) {
  const total =
    c.customersCount ||
    c.counters.scheduled + c.counters.queued + c.counters.inProgress + c.counters.ended;
  if (!total) return 0;
  return Math.min(100, Math.round((c.counters.ended / total) * 100));
}

// Motivos de encerramento da Vapi traduzidos (diagnóstico das ligações).
const ENDED_REASON_LABEL: Record<string, string> = {
  "silence-timeout-reached": "Silêncio: ninguém falou e a chamada caiu",
  "customer-did-not-answer": "Cliente não atendeu",
  "customer-did-not-give-microphone-permission": "Sem permissão de microfone",
  "customer-busy": "Linha ocupada",
  "customer-ended-call": "Cliente desligou",
  "assistant-ended-call": "Assistente encerrou a chamada",
  "assistant-said-end-call-phrase": "Assistente encerrou com frase final",
  "assistant-forwarded-call": "Chamada transferida",
  "voicemail": "Caiu na caixa postal",
  "exceeded-max-duration": "Duração máxima atingida",
  "manually-canceled": "Cancelada manualmente",
  "phone-call-provider-closed-websocket": "Áudio interrompido pela operadora (SIP)",
  "call.in-progress.error-sip-outbound-call-failed-to-connect":
    "A operadora (tronco SIP) recusou a ligação — a chamada nunca chegou a completar",
  "call.in-progress.error-sip-telephony-provider-failed-to-connect-call":
    "A operadora (tronco SIP) não conseguiu completar a ligação",
  "call.ringing.sip-inbound-caller-hungup": "Quem ligou desligou antes de atender",
};

// Erros de tronco SIP: a chamada nunca completa, então a IA nunca fala.
function isSipConnectFailure(reason: string | null): boolean {
  return !!reason && reason.includes("sip") && reason.includes("failed-to-connect");
}

function endedReasonLabel(reason: string | null): string {
  if (!reason) return "—";
  if (ENDED_REASON_LABEL[reason]) return ENDED_REASON_LABEL[reason];
  if (isSipConnectFailure(reason)) return "A operadora recusou a ligação (tronco SIP)";
  if (reason.startsWith("pipeline-error")) return `Erro de processamento de voz (${reason})`;
  if (reason.startsWith("assistant-request")) return `Erro ao carregar a assistente (${reason})`;
  if (reason.includes("transport")) return `Falha de transporte de áudio (${reason})`;
  return reason;
}


// --- Page -------------------------------------------------------------------

function CampanhasPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCampaigns = useServerFn(listVapiCampaigns);
  const fetchAssistants = useServerFn(listVapiAssistants);
  const fetchNumbers = useServerFn(listVapiPhoneNumbers);
  const createFn = useServerFn(createVapiCampaign);
  const endFn = useServerFn(endVapiCampaign);
  const deleteFn = useServerFn(deleteVapiCampaign);

  const campaignsQuery = useQuery({
    queryKey: ["vapi", "campaigns"],
    queryFn: () => fetchCampaigns(),
    refetchInterval: 30_000,
  });
  const assistantsQuery = useQuery({
    queryKey: ["assistants", "list"],
    queryFn: () => fetchAssistants(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const numbersQuery = useQuery({
    queryKey: ["vapi", "phone-numbers"],
    queryFn: () => fetchNumbers(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [latestAt, setLatestAt] = useState("");
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<VapiCampaignDTO | null>(null);
  const [diagCampaign, setDiagCampaign] = useState<VapiCampaignDTO | null>(null);

  const fetchCampaignCalls = useServerFn(listCampaignCalls);
  const diagQuery = useQuery({
    queryKey: ["vapi", "campaign-calls", diagCampaign?.id],
    queryFn: () => fetchCampaignCalls({ data: { campaignId: diagCampaign!.id } }),
    enabled: !!diagCampaign,
  });
  const diagCalls = diagQuery.data?.calls ?? [];
  const diagReference = diagQuery.data?.reference ?? null;
  const diagSameOrigin =
    diagReference && diagCalls[0]
      ? (diagReference.fromNumber ?? diagReference.phoneNumberId) ===
        (diagCalls[0].fromNumber ?? diagCalls[0].phoneNumberId)
      : null;


  const assistantName = useMemo(() => {
    const map = new Map<string, string>();
    (assistantsQuery.data ?? []).forEach((a) => map.set(a.id, a.name ?? "Sem nome"));
    return map;
  }, [assistantsQuery.data]);

  function resetForm() {
    setName("");
    setAssistantId("");
    setPhoneNumberId("");
    setStartedAt("");
    setLatestAt("");
    setCsv(null);
    setFileName("");
  }

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 5 MB).");
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.rows.length) {
      toast.error("Nenhum telefone válido encontrado no CSV.");
      return;
    }
    setCsv(parsed);
    setFileName(file.name);
    if (!name) setName(file.name.replace(/\.csv$/i, "").slice(0, 120));
    toast.success(`${parsed.rows.length} contatos carregados.`);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name: name.trim(),
          assistantId,
          phoneNumberId,
          customers: csv?.rows ?? [],
          ...(startedAt ? { startedAt } : {}),
          ...(latestAt ? { latestAt } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Campanha criada! As ligações começarão conforme o agendamento.");
      setOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["vapi", "campaigns"] });
    },
    onError: (e: Error) => toast.error(translateError(e)),
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => endFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Campanha encerrada.");
      void queryClient.invalidateQueries({ queryKey: ["vapi", "campaigns"] });
    },
    onError: (e: Error) => toast.error(translateError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Campanha excluída.");
      setConfirmDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["vapi", "campaigns"] });
    },
    onError: (e: Error) => toast.error(translateError(e)),
  });

  const campaigns = campaignsQuery.data ?? [];
  const numbers = numbersQuery.data ?? [];
  const canSubmit =
    !!name.trim() && !!assistantId && !!phoneNumberId && !!csv?.rows.length && !createMutation.isPending;

  const totals = useMemo(
    () => ({
      active: campaigns.filter((c) => c.status === "in-progress").length,
      contacts: campaigns.reduce((s, c) => s + c.customersCount, 0),
      ended: campaigns.reduce((s, c) => s + c.counters.ended, 0),
    }),
    [campaigns],
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Megaphone className="h-6 w-6 text-primary" />
              Campanhas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Suba uma lista CSV, escolha a assistente e o número de origem — as ligações são
              disparadas automaticamente.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Nova campanha
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={Play} label="Campanhas ativas" value={totals.active} />
          <SummaryCard icon={Users} label="Contatos na fila" value={totals.contacts} />
          <SummaryCard icon={CheckCircle2} label="Ligações concluídas" value={totals.ended} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suas campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : campaignsQuery.isError ? (
              <p className="py-8 text-center text-sm text-destructive">
                {(campaignsQuery.error as Error).message}
              </p>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma campanha ainda. Envie um CSV para começar a discar.
                </p>
                <Button variant="outline" onClick={() => setOpen(true)}>
                  Criar primeira campanha
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Assistente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.customersCount} contatos
                          {c.createdAt
                            ? ` • ${new Date(c.createdAt).toLocaleDateString("pt-BR")}`
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.assistantId ? (assistantName.get(c.assistantId) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_CLASS[c.status] ?? STATUS_CLASS.ended}
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-40">
                        <Progress value={campaignProgress(c)} className="h-2" />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.counters.ended} concluídas • {c.counters.inProgress} em curso
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setDiagCampaign(c)}>
                            <Stethoscope className="mr-1 h-3.5 w-3.5" />
                            Diagnóstico
                          </Button>
                          {c.status !== "ended" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => endMutation.mutate(c.id)}
                              disabled={endMutation.isPending}
                            >
                              <Square className="mr-1 h-3.5 w-3.5" />
                              Encerrar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setConfirmDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova campanha de ligações</DialogTitle>
            <DialogDescription>
              O CSV precisa de uma coluna com o telefone (e opcionalmente o nome). Números sem
              código de país são tratados como brasileiros (+55).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Lista de contatos (CSV)</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center transition hover:border-primary/50 hover:bg-muted/40"
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {fileName || "Clique para enviar seu arquivo .csv"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Exemplo de cabeçalho: nome,telefone
                </span>
              </button>

              {csv && (
                <div className="rounded-lg border border-border">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                      {csv.rows.length} válidos
                    </Badge>
                    {csv.invalid > 0 && (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                        {csv.invalid} ignorados
                      </Badge>
                    )}
                    <span className="text-muted-foreground">Prévia dos 5 primeiros</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csv.rows.slice(0, 5).map((r) => (
                        <TableRow key={r.number}>
                          <TableCell>{r.name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.number}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Prospecção — março"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assistente</Label>
                <Select value={assistantId} onValueChange={setAssistantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a assistente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(assistantsQuery.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name ?? "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de origem</Label>
                <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o número" />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.number ?? n.name ?? n.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {numbers.length === 0 && !numbersQuery.isLoading && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum número disponível. Cadastre um em Telefonia &amp; Números.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="started-at">Iniciar em (opcional)</Label>
                <Input
                  id="started-at"
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest-at">Encerrar até (opcional)</Label>
                <Input
                  id="latest-at"
                  type="datetime-local"
                  value={latestAt}
                  onChange={(e) => setLatestAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PhoneOutgoing className="mr-2 h-4 w-4" />
              )}
              Iniciar campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!diagCampaign} onOpenChange={(v) => !v && setDiagCampaign(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Diagnóstico das ligações</DialogTitle>
            <DialogDescription>
              Últimas chamadas da campanha “{diagCampaign?.name}” com o motivo real de
              encerramento informado pela plataforma de voz.
            </DialogDescription>
          </DialogHeader>

          {diagQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : diagQuery.isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              {translateError(diagQuery.error as Error)}
            </p>
          ) : diagCalls.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma ligação registrada nesta campanha ainda.
            </p>
          ) : (
            <>
              {diagCalls.some((c) => isSipConnectFailure(c.endedReason)) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium text-amber-300">
                    O telefone toca, mas a ligação não completa no tronco SIP
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    A operadora chega a tocar o celular, porém não devolve a confirmação de
                    atendimento nem o áudio de volta para a plataforma de voz. Por isso você atende
                    e ouve silêncio até a chamada cair: a assistente só começa a falar depois que a
                    ligação é considerada conectada. Verifique com a operadora a liberação do
                    retorno de mídia (RTP) para a plataforma, o número de origem liberado para
                    saída e o limite de canais simultâneos.
                  </p>
                </div>
              )}

              {diagReference && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Comparação com a última ligação de teste</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Teste manual</p>
                      <p className="font-mono text-xs">
                        origem {diagReference.fromNumber ?? diagReference.phoneNumberId ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {diagReference.answered ? "Conectou" : "Não conectou"} ·{" "}
                        {diagReference.durationSec}s · IA falou:{" "}
                        {diagReference.assistantSpoke ? "sim" : "não"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {endedReasonLabel(diagReference.endedReason)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Campanha</p>
                      <p className="font-mono text-xs">
                        origem {diagCalls[0]?.fromNumber ?? diagCalls[0]?.phoneNumberId ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {diagCalls.filter((c) => c.answered).length} de {diagCalls.length}{" "}
                        conectaram
                      </p>
                      {diagSameOrigin !== null && (
                        <p className="mt-1 text-xs font-medium text-amber-300">
                          {diagSameOrigin
                            ? "Mesmo número de origem do teste — o problema está na rota/canais do tronco."
                            : "Número de origem diferente do teste — use o mesmo número que funcionou."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Conectou?</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>IA falou?</TableHead>
                    <TableHead>Motivo do encerramento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono text-xs">
                        {call.fromNumber ?? call.phoneNumberId ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {call.customerNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            call.answered
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-amber-500/30 text-amber-400"
                          }
                        >
                          {call.answered ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {call.durationSec ? `${call.durationSec}s` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            call.assistantSpoke
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-amber-500/30 text-amber-400"
                          }
                        >
                          {call.assistantSpoke ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {endedReasonLabel(call.endedReason)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}



          <DialogFooter>
            <Button variant="outline" onClick={() => void diagQuery.refetch()}>
              Atualizar
            </Button>
            <Button onClick={() => setDiagCampaign(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha “{confirmDelete?.name}” será removida da Vapi. Ligações já realizadas
              continuam no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Play;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
