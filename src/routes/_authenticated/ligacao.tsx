import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneCall, PhoneOutgoing, Loader2, Check, TriangleAlert, Phone } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { translateError } from "@/lib/error-messages";
import {
  getMeuNumeroLigacao,
  salvarNumeroLigacao,
  fazerLigacao,
} from "@/lib/ligacao.functions";

export const Route = createFileRoute("/_authenticated/ligacao")({
  head: () => ({
    meta: [
      { title: "Ligação — Omniasyn" },
      { name: "description", content: "Cadastre seu número e dispare uma ligação de teste com a IA." },
      { property: "og:title", content: "Ligação — Omniasyn" },
      { property: "og:description", content: "Cadastre seu número e dispare uma ligação de teste com a IA." },
    ],
  }),
  component: LigacaoPage,
});

const E164_RE = /^\+[1-9]\d{7,14}$/;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

function LigacaoPage() {
  const queryClient = useQueryClient();
  const [telefone, setTelefone] = useState("");

  const numeroQuery = useQuery({
    queryKey: ["ligacao-numero"],
    queryFn: () => getMeuNumeroLigacao().catch(() => null),
    retry: false,
  });

  const salvar = useMutation({
    mutationFn: (tel: string) => salvarNumeroLigacao({ data: { telefone: tel } }),
    onSuccess: (r) => {
      toast.success(r.mensagem);
      queryClient.invalidateQueries({ queryKey: ["ligacao-numero"] });
    },
    onError: (e) => toast.error(translateError(e)),
  });

  const ligar = useMutation({
    mutationFn: () => fazerLigacao(),
    onError: (e) => toast.error(translateError(e)),
  });

  const numeroSalvo = numeroQuery.data?.telefone ?? null;
  const telefoneValido = E164_RE.test(telefone);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ligação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre seu número e dispare uma ligação de teste atendida pela IA.
          </p>
        </div>

        <Card className="border-border bg-card/20 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-primary" />
              Número de destino
            </CardTitle>
            <CardDescription>
              Número que vai receber a ligação. Use o formato internacional (E.164).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {numeroQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : numeroSalvo ? (
              <Alert className="border-primary/30 bg-primary/5">
                <Check className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Número cadastrado: <span className="font-semibold text-foreground">{numeroSalvo}</span>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>Nenhum número cadastrado ainda.</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone (E.164)</Label>
              <div className="flex gap-2">
                <Input
                  id="telefone"
                  placeholder="+5511999998888"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  onBlur={() => {
                    const n = normalizePhone(telefone);
                    if (n.length > 1) setTelefone(n);
                  }}
                />
                <Button
                  onClick={() => salvar.mutate(normalizePhone(telefone))}
                  disabled={!telefoneValido || salvar.isPending}
                >
                  {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar número"}
                </Button>
              </div>
              {telefone && !telefoneValido && (
                <p className="text-xs text-destructive">
                  Use o formato E.164, ex: +5511999998888
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/20 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneOutgoing className="h-4 w-4 text-primary" />
              Fazer ligação
            </CardTitle>
            <CardDescription>
              Dispara uma chamada para o número cadastrado. A ligação usa seu tronco SIP e pode gerar custo na operadora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => ligar.mutate()}
              disabled={!numeroSalvo || ligar.isPending}
            >
              {ligar.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discando…
                </>
              ) : (
                <>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Ligar agora
                </>
              )}
            </Button>

            {!numeroSalvo && !numeroQuery.isLoading && (
              <p className="text-center text-xs text-muted-foreground">
                Salve um número acima para habilitar a ligação.
              </p>
            )}

            {ligar.isSuccess && (
              <Alert className="border-primary/30 bg-primary/5">
                <Check className="h-4 w-4 text-primary" />
                <AlertDescription>
                  {ligar.data.mensagem} Atenda seu telefone — a IA vai falar com você.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
