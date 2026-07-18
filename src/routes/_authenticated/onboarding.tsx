import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, KeyRound, Loader2, Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowser } from "@/integrations/supabase/client";
import {
  getSetupStatus,
  getVapiConnection,
  saveVapiCredentials,
} from "@/lib/vapi.functions";
import {
  getTwilioConnection,
  saveTwilioCredentials,
} from "@/lib/twilio.functions";

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
  const vapiConn = useQuery({
    queryKey: ["vapi-connection"],
    queryFn: () => getVapiConnection(),
  });
  const twilioConn = useQuery({
    queryKey: ["twilio-connection"],
    queryFn: () => getTwilioConnection(),
  });

  const [vapiKey, setVapiKey] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");

  const saveVapi = useMutation({
    mutationFn: (privateKey: string) => saveVapiCredentials({ data: { privateKey } }),
    onSuccess: () => {
      toast.success("Vapi conectada!");
      setVapiKey("");
      qc.invalidateQueries({ queryKey: ["vapi-connection"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
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
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar Twilio"),
  });

  const bothReady = status.data?.vapi && status.data?.twilio;

  const handleContinue = () => navigate({ to: "/telefonia" });
  const handleLogout = async () => {
    await getSupabaseBrowser().auth.signOut();
    navigate({ to: "/", replace: true });
  };

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

        {/* Vapi */}
        <Card className="border-white/[0.08] bg-card/40 backdrop-blur-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  1. Vapi (voz + IA)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Painel Vapi → Organization → API Keys → Private Key
                </p>
              </div>
            </div>
            {vapiConn.data?.connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                <Check className="h-3 w-3" /> Conectada
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
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
            <Button
              disabled={saveVapi.isPending || vapiKey.trim().length < 20}
              onClick={() => saveVapi.mutate(vapiKey.trim())}
              className="w-full gap-2"
            >
              {saveVapi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {vapiConn.data?.connected ? "Atualizar chave Vapi" : "Salvar chave Vapi"}
            </Button>
          </CardContent>
        </Card>

        {/* Twilio */}
        <Card className="border-white/[0.08] bg-card/40 backdrop-blur-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  2. Twilio (telefonia)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Console Twilio → Account → API keys & tokens
                </p>
              </div>
            </div>
            {twilioConn.data?.connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                <Check className="h-3 w-3" /> Conectada
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
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
              className="w-full gap-2"
            >
              {saveTwilio.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {twilioConn.data?.connected ? "Atualizar Twilio" : "Salvar Twilio"}
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
            Sair
          </Button>
          <Button
            disabled={!bothReady}
            onClick={handleContinue}
            className="gap-2 shadow-glow"
          >
            <Check className="h-4 w-4" />
            {bothReady ? "Continuar para o app" : "Preencha as duas etapas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
