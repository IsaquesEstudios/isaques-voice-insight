import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { translateError } from "@/lib/error-messages";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import {
  connectSipNumber,
  getSetupStatus,
  saveVapiCredentials,
  updateVapiPublicKey,
} from "@/lib/vapi.functions";

import { resetSetupCache, skipSipStep } from "./route";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Omniasyn" },
      {
        name: "description",
        content:
          "Conecte sua chave Vapi e cadastre seu número via tronco SIP para começar.",
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

  const [vapiKey, setVapiKey] = useState("");
  const [vapiPublicKey, setVapiPublicKey] = useState("");
  const [editVapi, setEditVapi] = useState(false);

  // Etapa 2 — número via tronco SIP
  const [sipHost, setSipHost] = useState("");
  const [sipUsername, setSipUsername] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [friendlyLabel, setFriendlyLabel] = useState("");

  const vapiReady = !!status.data?.vapi;
  const numberReady = !!status.data?.sip;

  // Onboarding concluído (Vapi + número conectado) → painel.
  useEffect(() => {
    if (vapiReady && numberReady) {
      resetSetupCache();
      navigate({ to: "/dashboard", replace: true });
    }
  }, [vapiReady, numberReady, navigate]);

  const vapiHasPrivateOnly = !!status.data?.vapiPrivateOnly;

  const saveVapi = useMutation({
    mutationFn: async (v: { privateKey: string; publicKey: string }) => {
      if (vapiHasPrivateOnly) {
        return updateVapiPublicKey({ data: { publicKey: v.publicKey } });
      }
      return saveVapiCredentials({ data: v });
    },
    onSuccess: () => {
      toast.success("Vapi conectada! Agora cadastre seu número.");
      setVapiKey("");
      setVapiPublicKey("");
      setEditVapi(false);
      resetSetupCache();
      qc.invalidateQueries({ queryKey: ["vapi-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
    onError: (e) => toast.error(translateError(e, "Falha ao salvar Vapi")),
  });

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
      toast.success(`Número ${res.phoneNumber} conectado à Vapi!`);
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

  // Enquanto o status inicial não chega, evita renderizar o formulário errado
  // (pisca entre "só Public Key" e "os dois campos").
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
            Dois passos: conectar sua conta Vapi e cadastrar seu número através
            do seu tronco SIP — tudo por aqui, via API da Vapi.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold">
            <span
              className={`rounded-full px-2.5 py-1 ${vapiReady ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}
            >
              1. Chaves Vapi
            </span>
            <span className="text-muted-foreground">→</span>
            <span
              className={`rounded-full px-2.5 py-1 ${numberReady ? "bg-success/15 text-success" : vapiReady ? "bg-primary/15 text-primary" : "bg-foreground/[0.04] text-muted-foreground"}`}
            >
              2. Seu número
            </span>
          </div>

        </div>

        <Card className="border-border bg-card/40 backdrop-blur-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Vapi (voz + IA)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Onde acontece a inteligência da sua assistente virtual.
                </p>
              </div>
            </div>
            {vapiReady ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                <Check className="h-3 w-3" /> Conectada
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {vapiReady && !editVapi ? (
              <>
                <div className="rounded-xl border border-success/25 bg-success/10 p-3 text-xs text-white">
                  Sua conta Vapi já está conectada. Suas chaves ficam salvas e
                  você não precisa preencher de novo a cada login.
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setEditVapi(true)}
                    className="text-muted-foreground"
                  >
                    Trocar chaves
                  </Button>
                  <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                    Sair
                  </Button>
                </div>

              </>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-foreground/[0.04] p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1.5">
                    Como encontrar sua chave Vapi
                  </p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>
                      Acesse{" "}
                      <a
                        href="https://dashboard.vapi.ai/org/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        dashboard.vapi.ai <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      e faça login.
                    </li>
                    <li>
                      No menu lateral, clique em <span className="text-foreground">Organization</span> → <span className="text-foreground">API Keys</span>.
                    </li>
                    <li>
                      Copie a <span className="text-foreground">Private Key</span> (começa com <code className="rounded bg-background/60 px-1">vapi_sk_…</code>) — usada para gerenciar assistentes.
                    </li>
                    <li>
                      Copie também a <span className="text-foreground">Public Key</span> — necessária para o botão <span className="text-foreground">Testar no navegador</span>.
                    </li>
                  </ol>
                </div>

                {vapiHasPrivateOnly ? (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                    Sua Private Key já está salva. Falta apenas a{" "}
                    <span className="font-semibold">Public Key</span> para liberar o
                    teste no navegador e concluir o onboarding.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vapi Private Key</Label>
                    <Input
                      type="password"
                      placeholder="vapi_sk_…"
                      value={vapiKey}
                      onChange={(e) => setVapiKey(e.target.value)}
                      className="bg-background/50 font-mono text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Vapi Public Key</Label>
                  <Input
                    placeholder="ex.: 4c1a2f…"
                    value={vapiPublicKey}
                    onChange={(e) => setVapiPublicKey(e.target.value)}
                    className="bg-background/50 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Obrigatória — é a chave usada pelo botão “Testar no navegador”.
                  </p>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Depois de salvar, você segue para o passo 2: cadastrar seu
                  número pelo tronco SIP.
                </p>

                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                    Sair
                  </Button>
                  <div className="flex gap-2">
                    {vapiReady && editVapi ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditVapi(false);
                          setVapiKey("");
                          setVapiPublicKey("");
                        }}
                        className="text-muted-foreground"
                      >
                        Cancelar
                      </Button>
                    ) : null}
                    <Button
                      disabled={
                        saveVapi.isPending ||
                        vapiPublicKey.trim().length < 20 ||
                        (!vapiHasPrivateOnly && vapiKey.trim().length < 20)
                      }
                      onClick={() =>
                        saveVapi.mutate({
                          privateKey: vapiKey.trim(),
                          publicKey: vapiPublicKey.trim(),
                        })
                      }
                      className="gap-2 shadow-glow"
                    >
                      {saveVapi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Salvar e continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Etapa 2 — número via tronco SIP */}
        <Card
          className={`border-border bg-card/40 backdrop-blur-2xl ${vapiReady ? "" : "pointer-events-none opacity-50"}`}
        >
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
                  Conectamos o número à sua conta Vapi automaticamente pela API.
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
              já possui. Nós criamos a credencial SIP e importamos o número na
              sua conta Vapi.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Host / domínio SIP</Label>
                <Input
                  placeholder="ex.: sip.suaoperadora.com.br"
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

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                disabled={!vapiReady || connectNumber.isPending}
                onClick={() => {
                  skipSipStep();
                  navigate({ to: "/dashboard", replace: true });
                }}
                className="text-muted-foreground"
              >
                Já tenho número na Vapi — pular
              </Button>
              <Button
                disabled={
                  !vapiReady ||
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
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
