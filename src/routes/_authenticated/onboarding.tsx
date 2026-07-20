import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
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
import { getSupabaseBrowser } from "@/integrations/supabase/client";
import {
  getSetupStatus,
  saveVapiCredentials,
  updateVapiPublicKey,
} from "@/lib/vapi.functions";
import {
  getTwilioConnection,
  saveTwilioCredentials,
} from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Isaques Estúdios | AI Voice" },
      {
        name: "description",
        content: "Conecte suas chaves Vapi e Twilio para começar.",
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
  

  const twilioConn = useQuery({
    queryKey: ["twilio-connection"],
    queryFn: () => getTwilioConnection(),
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [vapiKey, setVapiKey] = useState("");
  const [vapiPublicKey, setVapiPublicKey] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [editVapi, setEditVapi] = useState(false);

  // Se Vapi está totalmente conectada (com public key) e Twilio não, pula para o passo 2.
  useEffect(() => {
    if (status.data?.vapi && !status.data?.twilio) {
      setStep(2);
    }
  }, [status.data?.vapi, status.data?.twilio]);

  // Se ambos já estão conectados, mandar direto para o dashboard.
  useEffect(() => {
    if (status.data?.vapi && status.data?.twilio) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [status.data?.vapi, status.data?.twilio, navigate]);

  const vapiHasPrivateOnly = !!status.data?.vapiPrivateOnly;

  const saveVapi = useMutation({
    mutationFn: async (v: { privateKey: string; publicKey: string }) => {
      if (vapiHasPrivateOnly) {
        return updateVapiPublicKey({ data: { publicKey: v.publicKey } });
      }
      return saveVapiCredentials({ data: v });
    },
    onSuccess: () => {
      toast.success("Vapi conectada!");
      setVapiKey("");
      setVapiPublicKey("");
      qc.invalidateQueries({ queryKey: ["vapi-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
      setStep(2);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar Vapi"),
  });

  const saveTwilio = useMutation({
    mutationFn: (v: { accountSid: string; authToken: string }) =>
      saveTwilioCredentials({ data: v }),
    onSuccess: () => {
      toast.success("Twilio conectada!");
      setTwilioSid("");
      setTwilioToken("");
      qc.invalidateQueries({ queryKey: ["twilio-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
      navigate({ to: "/telefonia" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar Twilio"),
  });

  const handleLogout = async () => {
    await getSupabaseBrowser().auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const vapiReady = !!status.data?.vapi;
  const twilioReady = twilioConn.data?.connected;

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
            Vamos conectar sua conta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada usuário usa suas próprias credenciais. Isso mantém seus dados,
            assistentes e números totalmente vinculados à sua conta.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-3">
          <StepDot n={1} active={step === 1} done={!!vapiReady} label="Vapi" />
          <div className="h-px w-10 bg-white/[0.08]" />
          <StepDot n={2} active={step === 2} done={!!twilioReady} label="Twilio" />
        </div>

        {step === 1 ? (
          <Card className="border-white/[0.08] bg-card/40 backdrop-blur-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Etapa 1 · Vapi (voz + IA)
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
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-muted-foreground">
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

              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                  Sair
                </Button>
                <div className="flex gap-2">
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
                    Próximo <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/[0.08] bg-card/40 backdrop-blur-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Etapa 2 · Twilio (telefonia)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Onde ficam seus números para chamadas reais.
                  </p>
                </div>
              </div>
              {twilioReady ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <Check className="h-3 w-3" /> Conectada
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1.5">
                  Como encontrar suas credenciais Twilio
                </p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://console.twilio.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      console.twilio.com <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    e faça login.
                  </li>
                  <li>
                    Na tela inicial, procure o painel <span className="text-foreground">Account Info</span>.
                  </li>
                  <li>
                    Copie o <span className="text-foreground">Account SID</span> (começa com <code className="rounded bg-background/60 px-1">AC…</code>) e o <span className="text-foreground">Auth Token</span>.
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Account SID</Label>
                  <Input
                    placeholder="AC…"
                    value={twilioSid}
                    onChange={(e) => setTwilioSid(e.target.value)}
                    className="bg-background/50 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Auth Token</Label>
                  <Input
                    type="password"
                    value={twilioToken}
                    onChange={(e) => setTwilioToken(e.target.value)}
                    className="bg-background/50 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="gap-2 text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  disabled={
                    saveTwilio.isPending ||
                    !/^AC[a-zA-Z0-9]{10,}$/.test(twilioSid.trim()) ||
                    twilioToken.trim().length < 8
                  }
                  onClick={() =>
                    saveTwilio.mutate({
                      accountSid: twilioSid.trim(),
                      authToken: twilioToken.trim(),
                    })
                  }
                  className="gap-2 shadow-glow"
                >
                  {saveTwilio.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Check className="h-4 w-4" /> Concluir e entrar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepDot({
  n,
  active,
  done,
  label,
}: {
  n: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold transition-colors",
          done
            ? "bg-success/20 text-success"
            : active
              ? "bg-primary/20 text-primary ring-1 ring-primary/40"
              : "bg-white/[0.05] text-muted-foreground",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <span
        className={cn(
          "text-xs font-medium",
          active || done ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}
