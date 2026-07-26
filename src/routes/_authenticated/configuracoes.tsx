import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Key,
  Bell,
  CreditCard,
  Building2,
  Webhook,
  User,
  Check,
  KeyRound,
  Phone,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  getVapiConnection,
  saveVapiCredentials,
  updateVapiPublicKey,
  getVapiEstimatedCredits,
  saveVapiBudget,
} from "@/lib/vapi.functions";
import {
  getTwilioConnection,
  saveTwilioCredentials,
  getTwilioBalance,
} from "@/lib/twilio.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações / API — Isaques Estúdios | AI Voice" }],
  }),
  component: ConfiguracoesPage,
});

type SectionId = "perfil" | "empresa" | "api" | "webhooks" | "notificacoes" | "faturamento";

const sections: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "api", label: "API & Chaves", icon: Key },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "faturamento", label: "Faturamento", icon: CreditCard },
];

function ConfiguracoesPage() {
  const [active, setActive] = useState<SectionId>("perfil");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie sua conta, integrações e faturamento.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          <Card className="border-white/[0.08] bg-card/20 p-2 backdrop-blur-2xl h-fit">
            <nav className="flex flex-col gap-0.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                    active === s.id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
              ))}
            </nav>
          </Card>

          <div className="space-y-6">
            {active === "perfil" && <PerfilSection />}
            {active === "api" && <ApiKeysSection />}
            {active === "notificacoes" && <NotificacoesSection />}
            {active === "faturamento" && <FaturamentoSection />}
            {active === "empresa" && <PlaceholderSection title="Empresa" desc="Em breve." />}
            {active === "webhooks" && <PlaceholderSection title="Webhooks" desc="Em breve." />}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function PerfilSection() {
  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary text-xl font-bold">
            IE
          </div>
          <div>
            <Button variant="outline" size="sm" className="border-white/[0.08] bg-background/40 backdrop-blur-xl">
              Alterar foto
            </Button>
            <p className="mt-1 text-[11px] text-muted-foreground">PNG ou JPG • até 2MB</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome completo</Label>
            <Input defaultValue="Isaque Silva" className="border-white/[0.08] bg-background/40 backdrop-blur-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input defaultValue="isaque@isaquesestudios.com" className="border-white/[0.08] bg-background/40 backdrop-blur-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa</Label>
            <Input defaultValue="Isaques Estúdios" className="border-white/[0.08] bg-background/40 backdrop-blur-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fuso horário</Label>
            <Input defaultValue="America/Sao_Paulo (UTC-3)" className="border-white/[0.08] bg-background/40 backdrop-blur-xl" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="gap-2 shadow-glow">
            <Check className="h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApiKeysSection() {
  const qc = useQueryClient();

  const vapi = useQuery({
    queryKey: ["vapi-connection"],
    queryFn: () => getVapiConnection(),
  });
  const twilio = useQuery({
    queryKey: ["twilio-connection"],
    queryFn: () => getTwilioConnection(),
  });

  const [vapiPrivate, setVapiPrivate] = useState("");
  const [vapiPublic, setVapiPublic] = useState("");
  const [showVapiPriv, setShowVapiPriv] = useState(false);
  const [showVapiPub, setShowVapiPub] = useState(false);

  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [showTwilioTok, setShowTwilioTok] = useState(false);

  const saveVapi = useMutation({
    mutationFn: async () => {
      // Se privada foi preenchida, salva tudo. Se só a public, atualiza somente ela.
      if (vapiPrivate.trim()) {
        return saveVapiCredentials({
          data: { privateKey: vapiPrivate.trim(), publicKey: vapiPublic.trim() },
        });
      }
      if (vapiPublic.trim()) {
        return updateVapiPublicKey({ data: { publicKey: vapiPublic.trim() } });
      }
      throw new Error("Informe ao menos uma chave para atualizar.");
    },
    onSuccess: () => {
      toast.success("Chaves Vapi atualizadas!");
      setVapiPrivate("");
      setVapiPublic("");
      qc.invalidateQueries({ queryKey: ["vapi-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar Vapi"),
  });

  const saveTwilio = useMutation({
    mutationFn: () =>
      saveTwilioCredentials({
        data: { accountSid: twilioSid.trim(), authToken: twilioToken.trim() },
      }),
    onSuccess: () => {
      toast.success("Credenciais Twilio atualizadas!");
      setTwilioSid("");
      setTwilioToken("");
      qc.invalidateQueries({ queryKey: ["twilio-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar Twilio"),
  });

  const vapiConnected = vapi.data?.connected;
  const twilioConnected = twilio.data?.connected;

  return (
    <div className="space-y-6">
      {/* VAPI */}
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Vapi (voz + IA)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Chaves usadas para gerenciar assistentes e testar no navegador.
              </p>
            </div>
          </div>
          <StatusBadge
            loading={vapi.isLoading}
            connected={!!vapiConnected}
            partial={!!vapiConnected && !vapi.data?.hasPublicKey}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {vapiConnected && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="text-foreground font-medium">Conta:</span>{" "}
                {vapi.data?.friendlyLabel ?? "—"}
              </p>
              <p>
                <span className="text-foreground font-medium">Public Key:</span>{" "}
                {vapi.data?.hasPublicKey ? "configurada ✓" : "faltando — necessária para testar no navegador"}
              </p>
              <p>
                <span className="text-foreground font-medium">Atualizada:</span>{" "}
                {vapi.data?.updatedAt ? new Date(vapi.data.updatedAt).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[11px] text-muted-foreground">
            Encontre suas chaves em{" "}
            <a
              href="https://dashboard.vapi.ai/org/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              dashboard.vapi.ai/org/api-keys <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Private Key {vapiConnected && <span className="text-muted-foreground">(deixe em branco para manter)</span>}</Label>
              <div className="relative">
                <Input
                  type={showVapiPriv ? "text" : "password"}
                  value={vapiPrivate}
                  onChange={(e) => setVapiPrivate(e.target.value)}
                  placeholder="vapi_sk_..."
                  className="pr-9 border-white/[0.08] bg-background/40 backdrop-blur-xl font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowVapiPriv((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showVapiPriv ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Public Key</Label>
              <div className="relative">
                <Input
                  type={showVapiPub ? "text" : "password"}
                  value={vapiPublic}
                  onChange={(e) => setVapiPublic(e.target.value)}
                  placeholder="Public key para testes no navegador"
                  className="pr-9 border-white/[0.08] bg-background/40 backdrop-blur-xl font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowVapiPub((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showVapiPub ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveVapi.mutate()}
              disabled={saveVapi.isPending || (!vapiPrivate.trim() && !vapiPublic.trim())}
              className="gap-2 shadow-glow"
            >
              {saveVapi.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar chaves Vapi
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TWILIO */}
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Twilio (telefonia)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Credenciais para comprar números, verificar caller IDs e realizar chamadas.
              </p>
            </div>
          </div>
          <StatusBadge loading={twilio.isLoading} connected={!!twilioConnected} />
        </CardHeader>
        <CardContent className="space-y-4">
          {twilioConnected && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="text-foreground font-medium">Account SID:</span>{" "}
                <span className="font-mono">
                  {twilio.data?.accountSid.slice(0, 8)}••••••{twilio.data?.accountSid.slice(-4)}
                </span>
              </p>
              <p>
                <span className="text-foreground font-medium">Atualizado:</span>{" "}
                {twilio.data?.updatedAt ? new Date(twilio.data.updatedAt).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[11px] text-muted-foreground">
            Encontre suas credenciais em{" "}
            <a
              href="https://console.twilio.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              console.twilio.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Account SID</Label>
              <Input
                value={twilioSid}
                onChange={(e) => setTwilioSid(e.target.value)}
                placeholder="AC..."
                className="border-white/[0.08] bg-background/40 backdrop-blur-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Auth Token</Label>
              <div className="relative">
                <Input
                  type={showTwilioTok ? "text" : "password"}
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="pr-9 border-white/[0.08] bg-background/40 backdrop-blur-xl font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowTwilioTok((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showTwilioTok ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveTwilio.mutate()}
              disabled={saveTwilio.isPending || !twilioSid.trim() || !twilioToken.trim()}
              className="gap-2 shadow-glow"
            >
              {saveTwilio.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar credenciais Twilio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({
  loading,
  connected,
  partial,
}: {
  loading: boolean;
  connected: boolean;
  partial?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Verificando
      </span>
    );
  }
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
        Não conectada
      </span>
    );
  }
  if (partial) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
        Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
      <Check className="h-3 w-3" /> Conectada
    </span>
  );
}

function NotificacoesSection() {
  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Notificações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          { label: "Lead qualificado", desc: "Notifica quando um lead atinge score ≥ 8", on: true },
          { label: "Número em risco de spam", desc: "Alerta quando health baixa", on: true },
          { label: "Resumo diário por e-mail", desc: "Envio às 08:00", on: false },
          { label: "Falha em webhook", desc: "3 falhas consecutivas", on: true },
        ].map((n) => (
          <div
            key={n.label}
            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{n.label}</p>
              <p className="text-[11px] text-muted-foreground">{n.desc}</p>
            </div>
            <Switch defaultChecked={n.on} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FaturamentoSection() {
  const qc = useQueryClient();
  const twilioConn = useQuery({
    queryKey: ["twilio-connection"],
    queryFn: () => getTwilioConnection(),
  });
  const twilioBalanceQuery = useQuery({
    queryKey: ["twilio-balance"],
    queryFn: () => getTwilioBalance(),
    enabled: !!twilioConn.data?.connected,
    staleTime: 60_000,
  });
  const vapiCreditsQuery = useQuery({
    queryKey: ["vapi-estimated-credits"],
    queryFn: () => getVapiEstimatedCredits(),
    staleTime: 60_000,
  });

  const [budgetInput, setBudgetInput] = useState<string>("");

  const vapi = vapiCreditsQuery.data;
  const vapiConnected = vapi?.ok === true;
  const vapiValue = vapi?.ok && vapi.balance !== null ? vapi.balance : null;

  const saveBudget = useMutation({
    mutationFn: (budget: number) =>
      saveVapiBudget({ data: { budget, lowBalanceThreshold: 0.2 } }),
    onSuccess: () => {
      toast.success("Orçamento Vapi salvo!");
      setBudgetInput("");
      qc.invalidateQueries({ queryKey: ["vapi-estimated-credits"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar orçamento"),
  });

  const refreshing = twilioBalanceQuery.isFetching || vapiCreditsQuery.isFetching;

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">Faturamento</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Saldo disponível na Twilio e saldo estimado na Vapi (baseado nas chamadas).
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={refreshing}
            onClick={() => {
              twilioBalanceQuery.refetch();
              vapiCreditsQuery.refetch();
            }}
            title="Atualizar saldos"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CompactCreditCard
          icon={Phone}
          title="Twilio"
          subtitle={
            twilioConn.data?.connected
              ? twilioBalanceQuery.data?.balance !== null && twilioBalanceQuery.data?.balance !== undefined
                ? "Saldo disponível na conta"
                : "Não foi possível ler o saldo"
              : "Conecte sua conta Twilio"
          }
          value={
            twilioBalanceQuery.data?.connected && twilioBalanceQuery.data.balance !== null
              ? twilioBalanceQuery.data.balance
              : null
          }
          currency={twilioBalanceQuery.data?.currency || "USD"}
          badge={
            twilioBalanceQuery.data?.accountType === "Trial"
              ? "Trial"
              : twilioBalanceQuery.data?.accountType === "Full"
                ? "Full"
                : undefined
          }
          loading={twilioBalanceQuery.isLoading}
          progress={twilioConn.data?.connected ? 0.65 : 0}
        />

        <CompactCreditCard
          icon={Sparkles}
          title="Vapi"
          subtitle={
            vapiConnected
              ? vapiValue !== null
                ? "Saldo estimado (orçamento − gastos)"
                : "Configure um orçamento para ver o saldo"
              : "Conecte sua conta Vapi"
          }
          value={vapiValue}
          currency="USD"
          badge={vapi?.ok ? "estimado" : undefined}
          loading={vapiCreditsQuery.isLoading}
          progress={vapi?.ok ? vapi.usageRatio : 0}
          lowBalance={vapi?.lowBalance}
        />
      </div>

      {vapiConnected && (
        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Orçamento Vapi</CardTitle>
            <p className="text-xs text-muted-foreground">
              A Vapi não expõe um endpoint de créditos. Informe seu crédito/orçamento para calcularmos o saldo estimado.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Crédito/orçamento (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder={
                    typeof vapi?.budget === "number"
                      ? new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "USD",
                        }).format(vapi.budget)
                      : "Ex: 100.00"
                  }
                  className="border-white/[0.08] bg-background/40 backdrop-blur-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gasto acumulado (90 dias)</Label>
                <div className="flex h-9 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground">
                  {typeof vapi?.spent === "number"
                    ? new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "USD",
                      }).format(vapi.spent)
                    : "—"}
                </div>
              </div>
            </div>

            {vapi?.lowBalance && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                Seu saldo estimado atingiu o limite de alerta. Considere recarregar seus créditos na Vapi.
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => saveBudget.mutate(Number(budgetInput))}
                disabled={
                  saveBudget.isPending || budgetInput === "" || Number.isNaN(Number(budgetInput))
                }
                className="gap-2 shadow-glow"
              >
                {saveBudget.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar orçamento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompactCreditCard({
  icon: Icon,
  title,
  subtitle,
  value,
  currency,
  badge,
  loading,
  progress,
}: {
  icon: typeof Phone;
  title: string;
  subtitle: string;
  value: number | null;
  currency: string;
  badge?: string;
  loading: boolean;
  progress: number;
}) {
  const fmt = (v: number, c: string) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v);

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/20 p-5 backdrop-blur-2xl">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-foreground">{title}</p>
            {badge ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          {loading ? (
            <div className="mt-2 h-6 w-24 animate-pulse rounded-md bg-white/[0.06]" />
          ) : typeof value === "number" ? (
            <p className="mt-1 text-xl font-bold text-foreground">{fmt(value, currency)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </Card>
  );
}


function PlaceholderSection({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
