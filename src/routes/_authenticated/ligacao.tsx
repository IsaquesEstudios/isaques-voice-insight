import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PhoneCall,
  PhoneOutgoing,
  Loader2,
  Check,
  TriangleAlert,
  Trash2,
  Plus,
  Server,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { translateError } from "@/lib/error-messages";
import {
  listarLinhasSip,
  criarLinhaSip,
  deletarLinhaSip,
  fazerLigacao,
} from "@/lib/ligacao.functions";

export const Route = createFileRoute("/_authenticated/ligacao")({
  head: () => ({
    meta: [
      { title: "Ligação — Omniasyn" },
      { name: "description", content: "Gerencie suas linhas SIP e dispare ligações com a IA." },
      { property: "og:title", content: "Ligação — Omniasyn" },
      { property: "og:description", content: "Gerencie suas linhas SIP e dispare ligações com a IA." },
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

const LINHAS_KEY = ["ligacao-linhas"];

function LigacaoPage() {
  const queryClient = useQueryClient();
  const [destino, setDestino] = useState("");
  const [linhaId, setLinhaId] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [form, setForm] = useState({
    nome_identificacao: "",
    telefone_associado: "",
    sip_host: "",
    sip_usuario: "",
    sip_senha: "",
  });

  const linhasQuery = useQuery({
    queryKey: LINHAS_KEY,
    queryFn: () => listarLinhasSip(),
    retry: false,
  });

  const linhas = linhasQuery.data?.ok ? linhasQuery.data.linhas : [];
  const erroLinhas = linhasQuery.data && !linhasQuery.data.ok ? linhasQuery.data.erro : null;

  useEffect(() => {
    if (linhas.length && !linhas.some((l) => l.id === linhaId)) {
      setLinhaId(linhas[0]!.id);
    }
  }, [linhas, linhaId]);

  const criar = useMutation({
    mutationFn: (payload: typeof form) => criarLinhaSip({ data: payload }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setNovaAberta(false);
      setForm({
        nome_identificacao: "",
        telefone_associado: "",
        sip_host: "",
        sip_usuario: "",
        sip_senha: "",
      });
      queryClient.invalidateQueries({ queryKey: LINHAS_KEY });
    },
    onError: (e) => toast.error(translateError(e)),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deletarLinhaSip({ data: { id } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      queryClient.invalidateQueries({ queryKey: LINHAS_KEY });
    },
    onError: (e) => toast.error(translateError(e)),
  });

  const ligar = useMutation({
    mutationFn: () =>
      fazerLigacao({
        data: { telefone_destino: normalizePhone(destino), id_configuracao_sip: linhaId },
      }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.erro);
    },
    onError: (e) => toast.error(translateError(e)),
  });

  const destinoValido = E164_RE.test(normalizePhone(destino));
  const formValido =
    form.nome_identificacao.trim() &&
    E164_RE.test(normalizePhone(form.telefone_associado)) &&
    form.sip_host.trim() &&
    form.sip_usuario.trim() &&
    form.sip_senha;

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ligação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie suas linhas SIP e dispare ligações atendidas pela IA.
          </p>
        </div>

        <Card className="border-border bg-card/20 backdrop-blur-2xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" />
                Linhas telefônicas (SIP)
              </CardTitle>
              <CardDescription>
                Cadastre um ou mais troncos SIP para originar as chamadas.
              </CardDescription>
            </div>
            <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Nova linha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova linha SIP</DialogTitle>
                  <DialogDescription>
                    Dados do tronco fornecidos pela sua operadora.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome de identificação</Label>
                    <Input
                      id="nome"
                      placeholder="Vendas SP"
                      value={form.nome_identificacao}
                      onChange={(e) => setForm({ ...form, nome_identificacao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tel-assoc">Telefone associado (E.164)</Label>
                    <Input
                      id="tel-assoc"
                      placeholder="+5511999998888"
                      value={form.telefone_associado}
                      onChange={(e) => setForm({ ...form, telefone_associado: e.target.value })}
                      onBlur={() =>
                        setForm((f) => ({
                          ...f,
                          telefone_associado: normalizePhone(f.telefone_associado) || f.telefone_associado,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sip-host">Host SIP</Label>
                    <Input
                      id="sip-host"
                      placeholder="sip.operadora.com.br"
                      value={form.sip_host}
                      onChange={(e) => setForm({ ...form, sip_host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sip-user">Usuário SIP</Label>
                    <Input
                      id="sip-user"
                      value={form.sip_usuario}
                      onChange={(e) => setForm({ ...form, sip_usuario: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sip-pass">Senha SIP</Label>
                    <Input
                      id="sip-pass"
                      type="password"
                      value={form.sip_senha}
                      onChange={(e) => setForm({ ...form, sip_senha: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      criar.mutate({
                        ...form,
                        telefone_associado: normalizePhone(form.telefone_associado),
                      })
                    }
                    disabled={!formValido || criar.isPending}
                  >
                    {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar linha"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            {linhasQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : erroLinhas ? (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>{erroLinhas}</AlertDescription>
              </Alert>
            ) : linhas.length === 0 ? (
              <Alert>
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>Nenhuma linha cadastrada ainda.</AlertDescription>
              </Alert>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {linhas.map((linha) => (
                  <li key={linha.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {linha.nome_identificacao}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {linha.telefone_associado}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${linha.nome_identificacao}`}
                      onClick={() => excluir.mutate(linha.id)}
                      disabled={excluir.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/20 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneOutgoing className="h-4 w-4 text-primary" />
              Fazer ligação
            </CardTitle>
            <CardDescription>
              Escolha a linha de origem e o número de destino. A chamada pode gerar custo na operadora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Linha de origem</Label>
              <Select value={linhaId} onValueChange={setLinhaId} disabled={linhas.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma linha" />
                </SelectTrigger>
                <SelectContent>
                  {linhas.map((linha) => (
                    <SelectItem key={linha.id} value={linha.id}>
                      {linha.nome_identificacao} — {linha.telefone_associado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destino">Telefone de destino (E.164)</Label>
              <Input
                id="destino"
                placeholder="+5511999998888"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                onBlur={() => {
                  const n = normalizePhone(destino);
                  if (n.length > 1) setDestino(n);
                }}
              />
              {destino && !destinoValido && (
                <p className="text-xs text-destructive">Use o formato E.164, ex: +5511999998888</p>
              )}
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => ligar.mutate()}
              disabled={!destinoValido || !linhaId || ligar.isPending}
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

            {ligar.isSuccess && ligar.data.ok && (
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
