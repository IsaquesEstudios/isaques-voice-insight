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
  Shield,
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
  getVapiCredits,
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
    queryKey: ["vapi-credits"],
    queryFn: () => getVapiCredits(),
    staleTime: 60_000,
  });

  const fmt = (v: number | null | undefined, currency: string) =>
    typeof v === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v)
      : "—";

  const twilio = twilioBalanceQuery.data;
  const vapi = vapiCreditsQuery.data;
  const refreshing = twilioBalanceQuery.isFetching || vapiCreditsQuery.isFetching;

  return (
    <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">Créditos & saldo</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Saldo disponível nas suas contas Twilio e Vapi.
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
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Twilio
              </p>
              {twilio?.connected && twilio.accountType ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {twilio.accountType === "Trial" ? "Trial" : "Full"}
                </span>
              ) : null}
            </div>
            {!twilioConn.data?.connected ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Conecte sua conta Twilio para ver o saldo.
              </p>
            ) : twilioBalanceQuery.isLoading ? (
              <div className="mt-3 h-7 w-32 animate-pulse rounded-md bg-white/[0.06]" />
            ) : twilio?.connected && twilio.balance !== null ? (
              <>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {fmt(twilio.balance, twilio.currency || "USD")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {twilio.friendlyName ?? "Conta Twilio"}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Não foi possível ler o saldo Twilio.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vapi
              </p>
              {vapi?.ok && vapi.plan ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {vapi.plan}
                </span>
              ) : null}
            </div>
            {vapiCreditsQuery.isLoading ? (
              <div className="mt-3 h-7 w-32 animate-pulse rounded-md bg-white/[0.06]" />
            ) : vapi?.ok && vapi.credits !== null ? (
              <>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {fmt(vapi.credits, "USD")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {vapi.billingLimit !== null && vapi.billingLimit !== undefined
                    ? `Limite mensal: ${fmt(vapi.billingLimit, "USD")}`
                    : (vapi.name ?? "Organização Vapi")}
                </p>
              </>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Créditos não disponíveis nesta conta.
                </p>
                <a
                  href="https://dashboard.vapi.ai/org/billing"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                >
                  Ver no dashboard da Vapi <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Recarregue direto nas plataformas
              </p>
              <p className="text-[11px] text-muted-foreground">
                Os saldos acima são das suas próprias contas Twilio e Vapi.
              </p>
            </div>
          </div>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
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
