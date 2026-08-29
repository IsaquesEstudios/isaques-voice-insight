import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { translateError } from "@/lib/error-messages";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  HelpCircle,
  Loader2,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import { connectSipNumber, getSetupStatus } from "@/lib/vapi.functions";

import { resetSetupCache, skipSipStep } from "@/lib/setup-gate";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Omniasyn" },
      {
        name: "description",
        content: "Cadastre seu número via tronco SIP para começar.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => getSetupStatus(),
  });

  // Número via tronco SIP
  const [sipHost, setSipHost] = useState("");
  const [sipUsername, setSipUsername] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [friendlyLabel, setFriendlyLabel] = useState("");

  const numberReady = !!status.data?.sip;

  // Onboarding concluído (número conectado) → painel.
  useEffect(() => {
    if (numberReady) {
      resetSetupCache();
      navigate({ to: "/dashboard", replace: true });
    }
  }, [numberReady, navigate]);

  const connectNumber = useMutation({
    mutationFn: async () =>
      connectSipNumber({
        data: {
          sipHost: sipHost.trim(),
          sipUsername: sipUsername.trim(),
          sipPassword: sipPassword.trim(),
          friendlyLabel: friendlyLabel.trim() || undefined,
          phoneNumber: phoneNumber.trim(),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Número ${res.phoneNumber} conectado!`);
      resetSetupCache();
      qc.invalidateQueries({ queryKey: ["setup-status"] });
      qc.invalidateQueries({ queryKey: ["vapi-phone-numbers"] });
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (e) => toast.error(translateError(e, "Falha ao conectar o número")),
  });

  const handleLogout = async () => {
    await getSupabaseBrowser().auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (status.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-glow">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Configuração inicial
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre seu número através do seu tronco SIP para começar — ou pule
            e configure depois.
          </p>
        </div>

        <Card className="border-border bg-card/40 backdrop-blur-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Seu número (tronco SIP)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Conectamos o número à sua conta automaticamente.
                </p>
              </div>
            </div>
            {numberReady ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                <Check className="h-3 w-3" /> Conectado
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 text-[11px] text-muted-foreground">
              Peça à sua operadora os dados de autenticação do tronco SIP
              (host/domínio, usuário e senha) e informe o número (DID) que você
              já possui. Este passo é opcional — você pode cadastrar depois na
              página Telefonia. O mesmo número serve para fazer e <b>receber</b>{" "}
              ligações: para receber, basta vincular um assistente a ele em
              Telefonia.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Host / domínio SIP</Label>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                          aria-label="Como descobrir o IP do domínio SIP"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-[11px] leading-relaxed">
                        O host precisa estar em formato de IP (ex.: 187.45.123.10).
                        Pegue o domínio que a operadora forneceu, abra o terminal e rode:
                        <code className="mt-1 block rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px]">
                          ping sip.suaoperadora.com.br
                        </code>
                        O IP aparecerá entre colchetes na resposta.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  placeholder="ex.: 187.45.123.10"
                  value={sipHost}
                  onChange={(e) => setSipHost(e.target.value)}
                  className="bg-background/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Usuário SIP</Label>
                <Input
                  placeholder="ex.: 1001"
                  value={sipUsername}
                  onChange={(e) => setSipUsername(e.target.value)}
                  className="bg-background/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Senha SIP</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={sipPassword}
                  onChange={(e) => setSipPassword(e.target.value)}
                  className="bg-background/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número (DID)</Label>
                <Input
                  placeholder="+5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-background/50 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Apelido (opcional)</Label>
                <Input
                  placeholder="ex.: Comercial SP"
                  value={friendlyLabel}
                  onChange={(e) => setFriendlyLabel(e.target.value)}
                  className="bg-background/50 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={connectNumber.isPending}
                onClick={() => {
                  skipSipStep();
                  toast.info(
                    "Você pode cadastrar seu número depois em Telefonia.",
                  );
                  navigate({ to: "/dashboard", replace: true });
                }}
              >
                Cadastrar depois
              </Button>
              <Button
                disabled={
                  connectNumber.isPending ||
                  sipHost.trim().length < 4 ||
                  sipUsername.trim().length < 2 ||
                  sipPassword.trim().length < 4 ||
                  phoneNumber.replace(/\D/g, "").length < 8
                }
                onClick={() => connectNumber.mutate()}
                className="gap-2 shadow-glow"
              >
                {connectNumber.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Conectar número e entrar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-xs text-muted-foreground"
              >
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
