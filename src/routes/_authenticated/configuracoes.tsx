import { createFileRoute } from "@tanstack/react-router";
import {
  Key,
  Bell,
  CreditCard,
  Building2,
  Webhook,
  User,
  Copy,
  Plus,
  Check,
  Shield,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações / API — Isaques Estúdios | AI Voice" }],
  }),
  component: ConfiguracoesPage,
});

const sections = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "api", label: "API & Chaves", icon: Key },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "faturamento", label: "Faturamento", icon: CreditCard },
];

const apiKeys = [
  { name: "Produção", key: "sk_live_9f2b•••••••••••••4d8a", created: "12/01/2026", lastUsed: "há 4min" },
  { name: "Desenvolvimento", key: "sk_test_18cd•••••••••••••e213", created: "02/03/2026", lastUsed: "há 2h" },
];

function ConfiguracoesPage() {
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
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                    i === 0
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

            <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">Chaves de API</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use no seu backend para acionar a plataforma.
                  </p>
                </div>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Nova chave
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {apiKeys.map((k) => (
                  <div
                    key={k.key}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Key className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground">{k.name}</p>
                        <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                          Ativa
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {k.key}
                      </p>
                    </div>
                    <div className="hidden md:block text-right text-[11px] text-muted-foreground">
                      <p>Criada {k.created}</p>
                      <p>Uso {k.lastUsed}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

              <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Plano & Faturamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Plano Growth</p>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      R$ 897<span className="text-sm text-muted-foreground">/mês</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Renova em 12/04/2026
                    </p>
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Créditos utilizados</span>
                        <span className="font-mono text-foreground">6.208 / 10.000</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background/60">
                        <div className="h-full w-[62%] rounded-full bg-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Visa •••• 4210</p>
                        <p className="text-[11px] text-muted-foreground">Expira 09/28</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="hover:text-primary">
                      Alterar
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full border-white/[0.08] bg-background/40 backdrop-blur-xl">
                    Fazer upgrade do plano
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
