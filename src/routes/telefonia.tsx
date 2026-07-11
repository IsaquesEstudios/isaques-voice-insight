import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  PhoneCall,
  ShieldCheck,
  AlertTriangle,
  Globe2,
  MoreVertical,
  Circle,
  Signal,
  Search,
  Phone,
  MessageSquare,
  Loader2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/telefonia")({
  head: () => ({
    meta: [{ title: "Telefonia & Números — Isaques Estúdios | AI Voice" }],
  }),
  component: TelefoniaPage,
});

type Health = "Seguro" | "Descanso" | "Risco";

interface NumberRow {
  number: string;
  region: string;
  provider: "Twilio" | "Vonage";
  assistant: string;
  callsToday: number;
  answerRate: number;
  health: Health;
}

const initialNumbers: NumberRow[] = [
  { number: "+55 11 4200-1101", region: "São Paulo / SP", provider: "Twilio", assistant: "Sofia • SDR", callsToday: 214, answerRate: 88, health: "Seguro" },
  { number: "+55 21 4200-2244", region: "Rio de Janeiro / RJ", provider: "Twilio", assistant: "Ricardo • Cobrança", callsToday: 178, answerRate: 62, health: "Descanso" },
  { number: "+55 31 4200-3378", region: "Belo Horizonte / MG", provider: "Vonage", assistant: "Marina • Agendamentos", callsToday: 90, answerRate: 91, health: "Seguro" },
  { number: "+55 41 4200-4487", region: "Curitiba / PR", provider: "Twilio", assistant: "Bianca • Recepção", callsToday: 322, answerRate: 79, health: "Seguro" },
  { number: "+55 51 4200-5591", region: "Porto Alegre / RS", provider: "Vonage", assistant: "Ricardo • Cobrança", callsToday: 41, answerRate: 24, health: "Risco" },
  { number: "+55 11 4200-6620", region: "São Paulo / SP", provider: "Twilio", assistant: "—", callsToday: 0, answerRate: 0, health: "Descanso" },
];

const healthStyles: Record<Health, string> = {
  Seguro: "bg-success/15 text-success",
  Descanso: "bg-chart-3/15 text-chart-3",
  Risco: "bg-destructive/15 text-destructive",
};

const routes = [
  { name: "Rota Comercial SP", numbers: 8, load: 74, status: "Ativo" },
  { name: "Rota Cobrança Nacional", numbers: 12, load: 58, status: "Ativo" },
  { name: "Rota Recepção 24/7", numbers: 4, load: 92, status: "Ativo" },
  { name: "Rota Sandbox", numbers: 2, load: 12, status: "Pausado" },
];

const countryConfig: Record<string, { dial: string; label: string; regionLabel: (area: string) => string }> = {
  BR: { dial: "+55", label: "Brasil (+55)", regionLabel: (a) => `DDD ${a} / BR` },
  US: { dial: "+1", label: "EUA (+1)", regionLabel: (a) => `Area ${a} / US` },
  CA: { dial: "+1", label: "Canadá (+1)", regionLabel: (a) => `Area ${a} / CA` },
};

interface AvailableNumber {
  id: string;
  number: string;
  region: string;
  voice: boolean;
  sms: boolean;
  monthlyCost: string;
}

async function mockSearchNumbers(country: string, area: string): Promise<AvailableNumber[]> {
  await new Promise((r) => setTimeout(r, 1000));
  const cfg = countryConfig[country];
  const dial = cfg.dial;
  const suffixes = ["9832-1401", "9744-2258", "9612-8877"];
  return suffixes.map((suf, i) => ({
    id: `${country}-${area}-${i}`,
    number: `${dial} ${area} ${suf}`,
    region: cfg.regionLabel(area),
    voice: true,
    sms: i !== 1,
    monthlyCost: "$1.00/mês",
  }));
}

function TelefoniaPage() {
  const [numbers, setNumbers] = useState<NumberRow[]>(initialNumbers);
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("BR");
  const [area, setArea] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const resetModal = () => {
    setCountry("BR");
    setArea("");
    setResults(null);
    setSearching(false);
    setBuyingId(null);
  };

  const handleSearch = async () => {
    if (!area.trim()) {
      toast.error("Informe um código de área.");
      return;
    }
    setSearching(true);
    setResults(null);
    try {
      const data = await mockSearchNumbers(country, area.trim());
      setResults(data);
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async (n: AvailableNumber) => {
    setBuyingId(n.id);
    try {
      // Simula POST /api/twilio/buy-number
      await new Promise((r) => setTimeout(r, 1200));
      const newRow: NumberRow = {
        number: n.number,
        region: n.region,
        provider: "Twilio",
        assistant: "—",
        callsToday: 0,
        answerRate: 0,
        health: "Seguro",
      };
      setNumbers((prev) => [newRow, ...prev]);
      toast.success(`Número ${n.number} adquirido e vinculado à sua conta!`);
      setOpen(false);
      resetModal();
    } catch {
      toast.error("Falha ao adquirir número. Tente novamente.");
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Telefonia & Números
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão de rotas, DIDs e políticas anti-spam.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl">
              <Globe2 className="h-4 w-4" /> Nova Rota
            </Button>
            <Button
              className="gap-2 shadow-glow"
              onClick={() => {
                resetModal();
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Adquirir número
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Números ativos", value: String(numbers.length), icon: PhoneCall, tone: "text-primary" },
            { label: "Seguros", value: String(numbers.filter((n) => n.health === "Seguro").length), icon: ShieldCheck, tone: "text-success" },
            { label: "Em descanso", value: String(numbers.filter((n) => n.health === "Descanso").length), icon: Signal, tone: "text-chart-3" },
            { label: "Risco de spam", value: String(numbers.filter((n) => n.health === "Risco").length), icon: AlertTriangle, tone: "text-destructive" },
          ].map((k) => (
            <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                </div>
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-background/60", k.tone)}>
                  <k.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Números (DIDs)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="px-6">Número</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Assistente</TableHead>
                      <TableHead>Hoje</TableHead>
                      <TableHead>Atendimento</TableHead>
                      <TableHead>Saúde</TableHead>
                      <TableHead className="px-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numbers.map((n) => (
                      <TableRow
                        key={n.number}
                        className="border-border/50 transition-colors hover:bg-primary/5"
                      >
                        <TableCell className="px-6">
                          <p className="font-mono text-xs font-medium text-foreground">{n.number}</p>
                          <p className="text-[10px] text-muted-foreground">{n.provider}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{n.region}</TableCell>
                        <TableCell className="text-xs text-foreground">{n.assistant}</TableCell>
                        <TableCell className="text-xs">{n.callsToday}</TableCell>
                        <TableCell className="text-xs">
                          {n.answerRate > 0 ? `${n.answerRate}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              healthStyles[n.health],
                            )}
                          >
                            <Circle className="h-1.5 w-1.5 fill-current" />
                            {n.health}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Rotas ativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {routes.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{r.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "Ativo"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.numbers} números vinculados
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          r.load > 85 ? "bg-destructive" : r.load > 60 ? "bg-chart-3" : "bg-primary",
                        )}
                        style={{ width: `${r.load}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{r.load}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetModal();
        }}
      >
        <DialogContent className="max-w-2xl border-white/[0.08] bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Adquirir Novo Número</DialogTitle>
            <DialogDescription>
              Pesquise a disponibilidade na rede da Twilio por país e código de área.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">País</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BR">Brasil (+55)</SelectItem>
                  <SelectItem value="US">EUA (+1)</SelectItem>
                  <SelectItem value="CA">Canadá (+1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full space-y-1.5 sm:w-32">
              <Label className="text-xs text-muted-foreground">Código de Área</Label>
              <Input
                inputMode="numeric"
                placeholder="Ex: 11"
                value={area}
                onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))}
                className="bg-background/50"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="gap-2 sm:w-auto"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar Números
            </Button>
          </div>

          <div className="min-h-[220px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
            {searching ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.03] p-3"
                  >
                    <div className="space-y-2">
                      <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
                      <div className="h-2 w-24 animate-pulse rounded bg-white/5" />
                    </div>
                    <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : results === null ? (
              <div className="flex h-[220px] flex-col items-center justify-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.04] text-muted-foreground">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Preencha os filtros acima para buscar números disponíveis
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                Nenhum número disponível para esses filtros.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {results.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {n.number}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{n.region}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {n.voice && (
                        <span
                          title="Voz"
                          className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.05]"
                        >
                          <Phone className="h-3 w-3" />
                        </span>
                      )}
                      {n.sms && (
                        <span
                          title="SMS"
                          className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.05]"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="w-20 text-right text-xs font-mono text-muted-foreground">
                      {n.monthlyCost}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleBuy(n)}
                      disabled={buyingId !== null}
                      className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                    >
                      {buyingId === n.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        "Comprar"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
