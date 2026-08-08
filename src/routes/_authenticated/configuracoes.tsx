import { createFileRoute } from "@tanstack/react-router";
import { translateError } from "@/lib/error-messages";
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
  getVapiBilling,
  getVapiEstimatedCredits,
  saveVapiBudget,
} from "@/lib/vapi.functions";
import type { VapiBillingMonth } from "@/lib/vapi.functions";
import { getSipConnection, saveSipTrunk } from "@/lib/sip.functions";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";


export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações / API — Omniasyn" }],
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
          <Card className="border-border bg-card/20 p-2 backdrop-blur-2xl h-fit">
            <nav className="flex flex-col gap-0.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                    active === s.id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
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

function initialsFrom(name: string, email: string) {
  const base = name.trim() || email.trim();
  if (!base) return "?";
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function PerfilSection() {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  });

  const [form, setForm] = useState<{
    fullName: string;
    company: string;
    timezone: string;
  } | null>(null);

  const current = form ?? {
    fullName: profile.data?.fullName ?? "",
    company: profile.data?.company ?? "",
    timezone: profile.data?.timezone ?? "America/Sao_Paulo",
  };

  const save = useMutation({
    mutationFn: async () =>
      updateMyProfile({
        data: {
          fullName: current.fullName.trim(),
          company: current.company.trim(),
          timezone: current.timezone.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado!");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e) => toast.error(translateError(e, "Falha ao salvar o perfil")),
  });

  return (
    <Card className="border-border bg-card/20 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile.isLoading ? (
          <div className="space-y-4">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-foreground/10" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-foreground/10" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary text-xl font-bold">
                {initialsFrom(current.fullName, profile.data?.email ?? "")}
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="border-border bg-background/40 backdrop-blur-xl"
                >
                  Alterar foto
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">Em breve</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome completo</Label>
                <Input
                  value={current.fullName}
                  onChange={(e) => setForm({ ...current, fullName: e.target.value })}
                  placeholder="Seu nome"
                  className="border-border bg-background/40 backdrop-blur-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input
                  value={profile.data?.email ?? ""}
                  readOnly
                  className="border-border bg-background/40 backdrop-blur-xl opacity-70"
                />
                <p className="text-[11px] text-muted-foreground">
                  É o e-mail usado para entrar na conta.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa</Label>
                <Input
                  value={current.company}
                  onChange={(e) => setForm({ ...current, company: e.target.value })}
                  placeholder="Nome da sua empresa"
                  className="border-border bg-background/40 backdrop-blur-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fuso horário</Label>
                <Input
                  value={current.timezone}
                  onChange={(e) => setForm({ ...current, timezone: e.target.value })}
                  className="border-border bg-background/40 backdrop-blur-xl"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="gap-2 shadow-glow"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar alterações
              </Button>
            </div>
          </>
        )}
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
  const sip = useQuery({
    queryKey: ["sip-connection"],
    queryFn: () => getSipConnection(),
  });

  const [vapiPrivate, setVapiPrivate] = useState("");
  const [vapiPublic, setVapiPublic] = useState("");
  const [showVapiPriv, setShowVapiPriv] = useState(false);
  const [showVapiPub, setShowVapiPub] = useState(false);

  const [sipForm, setSipForm] = useState({
    sipHost: "",
    sipUsername: "",
    sipPassword: "",
  });
  const [showSipSecrets, setShowSipSecrets] = useState(false);


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
    onError: (e) => toast.error(translateError(e, "Falha ao salvar Vapi")),
  });

  const saveSip = useMutation({
    mutationFn: () =>
      saveSipTrunk({
        data: {
          sipHost: sipForm.sipHost.trim(),
          sipUsername: sipForm.sipUsername.trim(),
          sipPassword: sipForm.sipPassword.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Tronco SIP atualizado!");
      setSipForm({ sipHost: "", sipUsername: "", sipPassword: "" });
      qc.invalidateQueries({ queryKey: ["sip-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
    onError: (e) => toast.error(translateError(e, "Falha ao salvar o tronco SIP")),
  });

  const vapiConnected = vapi.data?.connected;
  const sipConnected = sip.data?.connected;


  return (
    <div className="space-y-6">
      {/* VAPI */}
      <Card className="border-border bg-card/20 backdrop-blur-2xl">
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
            <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 text-xs text-muted-foreground space-y-1">
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

          <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 text-[11px] text-muted-foreground">
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
                  className="pr-9 border-border bg-background/40 backdrop-blur-xl font-mono text-xs"
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
                  className="pr-9 border-border bg-background/40 backdrop-blur-xl font-mono text-xs"
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

      {/* TRONCO SIP (opcional) */}
      <Card className="border-border bg-card/20 backdrop-blur-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Tronco SIP (opcional)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Conecte o tronco SIP da sua operadora para usar números próprios.
                Não é obrigatório — você pode usar números da sua conta Vapi.
              </p>
            </div>
          </div>
          <StatusBadge loading={sip.isLoading} connected={!!sipConnected} />
        </CardHeader>
        <CardContent className="space-y-4">
          {sipConnected && (
            <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="text-foreground font-medium">Tronco SIP:</span>{" "}
                <span className="font-mono">
                  {sip.data?.sipUsername}@{sip.data?.sipHost}
                </span>
              </p>
              <p>
                <span className="text-foreground font-medium">Atualizado:</span>{" "}
                {sip.data?.updatedAt
                  ? new Date(sip.data.updatedAt).toLocaleString("pt-BR")
                  : "—"}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 text-[11px] text-muted-foreground">
            Use os dados de autenticação SIP fornecidos pela sua operadora
            (servidor, usuário e senha).
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Servidor SIP</Label>
              <Input
                value={sipForm.sipHost}
                onChange={(e) => setSipForm((f) => ({ ...f, sipHost: e.target.value }))}
                placeholder="sip.suaoperadora.com.br"
                className="border-border bg-background/40 backdrop-blur-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Usuário SIP</Label>
              <Input
                value={sipForm.sipUsername}
                onChange={(e) => setSipForm((f) => ({ ...f, sipUsername: e.target.value }))}
                className="border-border bg-background/40 backdrop-blur-xl font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha SIP</Label>
              <div className="relative">
                <Input
                  type={showSipSecrets ? "text" : "password"}
                  value={sipForm.sipPassword}
                  onChange={(e) =>
                    setSipForm((f) => ({ ...f, sipPassword: e.target.value }))
                  }
                  placeholder="••••••••"
                  className="pr-9 border-border bg-background/40 backdrop-blur-xl font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowSipSecrets((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSipSecrets ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveSip.mutate()}
              disabled={
                saveSip.isPending ||
                !sipForm.sipHost.trim() ||
                !sipForm.sipUsername.trim() ||
                !sipForm.sipPassword.trim()
              }
              className="gap-2 shadow-glow"
            >
              {saveSip.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar tronco SIP
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
      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2 py-0.5 text-[11px] text-muted-foreground">
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
    <Card className="border-border bg-card/20 backdrop-blur-2xl">
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
            className="flex items-center justify-between rounded-xl border border-border bg-foreground/[0.04] p-3 backdrop-blur-xl"
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

const usd = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(iso))
    .replace(".", "");

function FaturamentoSection() {
  const qc = useQueryClient();

  const billingQuery = useQuery({
    queryKey: ["vapi-billing"],
    queryFn: () => getVapiBilling(),
    staleTime: 60_000,
  });
  // Usado apenas para ler/gravar o limite de alerta configurado pelo usuário.
  const budgetQuery = useQuery({
    queryKey: ["vapi-estimated-credits"],
    queryFn: () => getVapiEstimatedCredits(),
    staleTime: 60_000,
  });

  const [budgetInput, setBudgetInput] = useState<string>("");

  const billing = billingQuery.data;
  const budget =
    typeof budgetQuery.data?.budget === "number" ? budgetQuery.data.budget : null;
  const currentCost = billing?.currentMonth?.cost ?? 0;
  const progress =
    budget && budget > 0 ? Math.min(1, Math.max(0, currentCost / budget)) : 0;
  const overBudget = budget !== null && budget > 0 && currentCost >= budget * 0.8;

  const saveBudget = useMutation({
    mutationFn: (value: number) =>
      saveVapiBudget({ data: { budget: value, lowBalanceThreshold: 0.2 } }),
    onSuccess: () => {
      toast.success("Limite de alerta salvo!");
      setBudgetInput("");
      qc.invalidateQueries({ queryKey: ["vapi-estimated-credits"] });
    },
    onError: (e) => toast.error(translateError(e, "Falha ao salvar limite")),
  });

  const refreshing = billingQuery.isFetching;
  const breakdown = billing?.breakdown;
  const breakdownItems = breakdown
    ? [
        { label: "Modelo de IA (LLM)", value: breakdown.llm },
        { label: "Transcrição (STT)", value: breakdown.stt },
        { label: "Voz (TTS)", value: breakdown.tts },
        { label: "Plataforma Vapi", value: breakdown.vapi },
        { label: "Telefonia / transporte", value: breakdown.transport },
      ]
    : [];
  const breakdownTotal = breakdownItems.reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card/20 backdrop-blur-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">Faturamento</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Dados reais da sua conta Vapi
              {billing?.org?.name ? ` — ${billing.org.name}` : ""}
              {billing?.org?.plan ? ` (plano ${billing.org.plan})` : ""}.
              {billing?.syncedAt
                ? ` Atualizado às ${new Intl.DateTimeFormat("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(billing.syncedAt))}.`
                : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={refreshing}
            onClick={() => {
              billingQuery.refetch();
            }}
            title="Atualizar faturamento"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </CardHeader>
      </Card>

      {billing && billing.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Não foi possível ler o faturamento na Vapi:{" "}
          {translateError(billing.error, "erro desconhecido")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CompactCreditCard
          icon={Sparkles}
          title="Mês atual"
          subtitle="Gasto real na Vapi"
          value={billing?.currentMonth ? billing.currentMonth.cost : null}
          currency="USD"
          loading={billingQuery.isLoading}
          progress={progress}
          lowBalance={overBudget}
        />
        <CompactCreditCard
          icon={CreditCard}
          title="Mês anterior"
          subtitle="Total faturado"
          value={billing?.previousMonth ? billing.previousMonth.cost : null}
          currency="USD"
          loading={billingQuery.isLoading}
          progress={0}
        />
        <StatTile
          label="Minutos usados (mês)"
          value={
            billingQuery.isLoading
              ? null
              : `${(billing?.currentMonth?.minutes ?? 0).toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })} min`
          }
        />
        <StatTile
          label="Chamadas (mês)"
          value={
            billingQuery.isLoading
              ? null
              : `${billing?.currentMonth?.calls ?? 0}`
          }
        />
      </div>

      <Card className="border-border bg-card/20 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Composição do custo (mês atual)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {billingQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-foreground/[0.04]" />
          ) : breakdownTotal <= 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há custos registrados neste mês.
            </p>
          ) : (
            breakdownItems.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{usd(item.value)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.04]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                    style={{
                      width: `${Math.round((item.value / breakdownTotal) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/20 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {billingQuery.isLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-foreground/[0.04]" />
          ) : (billing?.monthly.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum consumo registrado no período.
            </p>
          ) : (
            (billing?.monthly ?? []).map((m) => {
              const max = Math.max(...(billing?.monthly ?? []).map((x) => x.cost), 0.0001);
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">
                    {monthLabel(m.month)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.04]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                      style={{ width: `${Math.round((m.cost / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs font-medium text-foreground">
                    {usd(m.cost)}
                  </span>
                  <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
                    {m.calls} lig.
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/20 backdrop-blur-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Limite de alerta (opcional)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Defina um valor mensal de referência. Avisamos quando o gasto real do mês
            chegar perto dele.
            {billing?.org?.billingLimit !== null && billing?.org?.billingLimit !== undefined
              ? ` Limite configurado na Vapi: ${usd(billing.org.billingLimit)}.`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Limite mensal (USD)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder={budget !== null ? usd(budget) : "Ex: 100.00"}
                className="border-border bg-background/40 backdrop-blur-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gasto do mês atual</Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-foreground/[0.04] px-3 text-sm text-foreground">
                {billingQuery.isLoading ? "—" : usd(currentCost)}
              </div>
            </div>
          </div>

          {overBudget && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              O gasto do mês já atingiu 80% do limite definido. Considere revisar o uso
              ou recarregar créditos na Vapi.
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => saveBudget.mutate(Number(budgetInput))}
              disabled={
                saveBudget.isPending ||
                budgetInput === "" ||
                Number.isNaN(Number(budgetInput))
              }
              className="gap-2 shadow-glow"
            >
              {saveBudget.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar limite
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | null }) {
  return (
    <Card className="rounded-2xl border border-border bg-card/20 p-5 backdrop-blur-2xl">
      <p className="text-sm text-muted-foreground">{label}</p>
      {value === null ? (
        <div className="mt-2 h-6 w-20 animate-pulse rounded-md bg-foreground/[0.04]" />
      ) : (
        <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      )}
    </Card>
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
  lowBalance,
}: {
  icon: typeof Phone;
  title: string;
  subtitle: string;
  value: number | null;
  currency: string;
  badge?: string;
  loading: boolean;
  progress: number;
  lowBalance?: boolean;
}) {
  const fmt = (v: number, c: string) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v);

  const barColor = lowBalance
    ? "bg-destructive"
    : progress > 0.8
      ? "bg-amber-500"
      : "bg-gradient-to-r from-primary to-success";

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border bg-card/20 p-5 backdrop-blur-2xl">
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
            <div className="mt-2 h-6 w-24 animate-pulse rounded-md bg-foreground/[0.04]" />
          ) : typeof value === "number" ? (
            <p className="mt-1 text-xl font-bold text-foreground">{fmt(value, currency)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-foreground/[0.04]">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </Card>
  );
}


function PlaceholderSection({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="border-border bg-card/20 backdrop-blur-2xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
