import { createFileRoute } from "@tanstack/react-router";
import { translateError } from "@/lib/error-messages";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Key, Bell, CreditCard, Building2, Webhook, User, Check, Loader2 } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
            {active === "api" && (
              <PlaceholderSection title="API & Chaves" desc="Nenhuma integração conectada." />
            )}
            {active === "notificacoes" && <NotificacoesSection />}
            {active === "faturamento" && (
              <PlaceholderSection title="Faturamento" desc="Em breve." />
            )}
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
