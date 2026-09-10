import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Phone, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { translateError } from "@/lib/error-messages";
import { listarAtendentesIa, salvarAtendenteIa } from "@/lib/atendente-ia.functions";
import { listLivekitAgents } from "@/lib/livekit.functions";

export const Route = createFileRoute("/_authenticated/atendente-ia")({
  head: () => ({
    meta: [
      { title: "Atendente por IA — Omniasyn" },
      {
        name: "description",
        content:
          "Configure o atendimento receptivo por IA de cada número: saudação, instruções, voz e transferências.",
      },
      { property: "og:title", content: "Atendente por IA — Omniasyn" },
      {
        property: "og:description",
        content: "Configure o atendimento receptivo por IA dos seus números.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AtendenteIaPage,
});

const E164_RE = /^\+[1-9]\d{7,14}$/;

function formatarE164(valor: string) {
  const digits = valor.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

type Departamento = { id: number; nome: string; numero: string };

type FormState = {
  usar_ia: boolean;
  saudacao: string;
  prompt: string;
  voz_id: string;
  padrao: string;
  departamentos: Departamento[];
};

function AtendenteIaPage() {
  const queryClient = useQueryClient();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    usar_ia: true,
    saudacao: "",
    prompt: "",
    voz_id: "",
    padrao: "",
    departamentos: [],
  });

  const atendentes = useQuery({
    queryKey: ["atendentes-ia"],
    queryFn: () => listarAtendentesIa(),
  });

  const agentes = useQuery({
    queryKey: ["livekit-agents"],
    queryFn: () => listLivekitAgents(),
  });

  const itens = atendentes.data?.ok ? atendentes.data.itens : [];

  const atual = useMemo(
    () => itens.find((i) => i.sip_trunk_id === selecionado) ?? null,
    [itens, selecionado],
  );

  useEffect(() => {
    if (!selecionado && itens.length > 0) setSelecionado(itens[0]!.sip_trunk_id);
  }, [itens, selecionado]);

  useEffect(() => {
    if (!atual) return;
    setForm({
      usar_ia: atual.usar_ia,
      saudacao: atual.saudacao,
      prompt: atual.prompt,
      voz_id: atual.voz_id ?? "",
      padrao: atual.numero_transferencia_padrao ?? "",
      departamentos: Object.entries(atual.numeros_transferencia).map(([nome, numero], i) => ({
        id: i,
        nome,
        numero,
      })),
    });
  }, [atual]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!atual) throw new Error("Selecione um número.");
      const numeros_transferencia: Record<string, string> = {};
      for (const d of form.departamentos) {
        const nome = d.nome.trim();
        const numero = d.numero.trim();
        if (!nome && !numero) continue;
        if (!nome) throw new Error("Dê um nome para cada departamento.");
        if (!E164_RE.test(numero)) {
          throw new Error(`Número inválido em "${nome}". Use o formato +5511999999999.`);
        }
        numeros_transferencia[nome] = numero;
      }
      if (form.padrao && !E164_RE.test(form.padrao)) {
        throw new Error("Número de transferência padrão inválido.");
      }
      const res = await salvarAtendenteIa({
        data: {
          sip_trunk_id: atual.sip_trunk_id,
          telefone: atual.telefone,
          nome: atual.nome,
          usar_ia: form.usar_ia,
          prompt: form.prompt,
          saudacao: form.saudacao,
          voz_id: form.voz_id || undefined,
          numeros_transferencia,
          numero_transferencia_padrao: form.padrao,
        },
      });
      if (!res.ok) return res;

      // Envia direto do navegador para o backend externo (sem intermediário).
      const payload = form.usar_ia
        ? {
            usar_ia: true,
            prompt: form.prompt,
            saudacao: form.saudacao,
            voz_id: form.voz_id || null,
            sip_trunk_id: atual.sip_trunk_id,
            numeros_transferencia,
            numero_transferencia_padrao: form.padrao || null,
          }
        : {
            usar_ia: false,
            sip_trunk_id: atual.sip_trunk_id,
            numero_transferencia_padrao: form.padrao || null,
          };

      const { data: sessao } = await getSupabaseBrowser().auth.getSession();
      const token = sessao.session?.access_token;

      let resposta: Response;
      try {
        resposta = await fetch(BACKEND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      } catch {
        return {
          ok: false as const,
          erro: "Configuração salva no painel, mas o servidor de ligação não respondeu.",
        };
      }

      if (!resposta.ok) {
        const bruto = await resposta.text().catch(() => "");
        let detalhe = bruto.slice(0, 300);
        try {
          const j = JSON.parse(bruto) as Record<string, unknown>;
          if (typeof j.detail === "string") detalhe = j.detail;
        } catch {
          if (/^\s*(<!doctype|<html)/i.test(bruto) || resposta.status >= 502) {
            detalhe = `O servidor de ligação está fora do ar (erro ${resposta.status}).`;
          }
        }
        return {
          ok: false as const,
          erro: `Configuração salva no painel, mas o backend recusou: ${detalhe}`,
        };
      }

      return res;
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      toast.success(res.mensagem ?? "Atendente configurado com sucesso!");
      void queryClient.invalidateQueries({ queryKey: ["atendentes-ia"] });
    },
    onError: (e) => toast.error(translateError(e)),
  });

  const carregando = atendentes.isLoading;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Atendente por IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha um dos seus números e configure como a IA vai atender as ligações recebidas.
          </p>
        </div>

        {atendentes.data && !atendentes.data.ok && (
          <Alert variant="destructive">
            <AlertDescription>{atendentes.data.erro}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Seus números</CardTitle>
              <CardDescription>Cadastrados na página Ligação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {carregando ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))
              ) : itens.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum número cadastrado ainda. Cadastre uma linha SIP na página Ligação.
                </p>
              ) : (
                itens.map((i) => {
                  const ativo = i.sip_trunk_id === selecionado;
                  return (
                    <button
                      key={i.sip_trunk_id || i.telefone}
                      type="button"
                      onClick={() => setSelecionado(i.sip_trunk_id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        ativo
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Phone className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{i.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {i.telefone} • {i.sip_trunk_id || "sem tronco"}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-4 w-4 text-primary" />
                    Configuração do atendimento
                  </CardTitle>
                  <CardDescription>
                    {atual ? `${atual.nome} — ${atual.telefone}` : "Selecione um número"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="usar-ia" className="text-xs text-muted-foreground">
                    Atender com IA
                  </Label>
                  <Switch
                    id="usar-ia"
                    checked={form.usar_ia}
                    disabled={!atual}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, usar_ia: v }))}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {!atual ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Escolha um número à esquerda para configurar.
                </p>
              ) : (
                <>
                  {!atual.sip_trunk_id && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Esta linha ainda não tem o tronco SIP (ST_...) salvo. Cadastre a linha
                        novamente na página Ligação antes de configurar a IA.
                      </AlertDescription>
                    </Alert>
                  )}

                  {form.usar_ia && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="saudacao">Saudação (primeira fala)</Label>
                        <Input
                          id="saudacao"
                          value={form.saudacao}
                          onChange={(e) => setForm((f) => ({ ...f, saudacao: e.target.value }))}
                          placeholder="Olá! Bem-vindo à Clínica Sorriso. Como posso te ajudar hoje?"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prompt">Instruções da IA</Label>
                        <Textarea
                          id="prompt"
                          rows={6}
                          value={form.prompt}
                          onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                          placeholder="Você é a recepcionista da clínica Sorriso. Seja alegre e prestativa..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Voz do atendente</Label>
                        <Select
                          value={form.voz_id}
                          onValueChange={(v) => setForm((f) => ({ ...f, voz_id: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha um agente configurado" />
                          </SelectTrigger>
                          <SelectContent>
                            {(agentes.data ?? [])
                              .filter((a) => (a.voz ?? "").trim())
                              .map((a) => (
                                <SelectItem key={a.id} value={(a.voz ?? "").trim()}>
                                  {a.name} — {a.voz}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          As vozes vêm dos agentes criados em Assistentes Virtuais.
                        </p>
                      </div>
                    </>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Números de transferência</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            departamentos: [
                              ...f.departamentos,
                              { id: Date.now(), nome: "", numero: "" },
                            ],
                          }))
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Departamento
                      </Button>
                    </div>

                    {form.departamentos.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum departamento. A IA usará apenas o número padrão.
                      </p>
                    )}

                    {form.departamentos.map((d, idx) => (
                      <div key={d.id} className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={d.nome}
                          placeholder="Vendas ou Planos"
                          onChange={(e) =>
                            setForm((f) => {
                              const deps = [...f.departamentos];
                              deps[idx] = { ...deps[idx]!, nome: e.target.value };
                              return { ...f, departamentos: deps };
                            })
                          }
                        />
                        <Input
                          className="w-52"
                          value={d.numero}
                          placeholder="+5511999991111"
                          onChange={(e) =>
                            setForm((f) => {
                              const deps = [...f.departamentos];
                              deps[idx] = { ...deps[idx]!, numero: formatarE164(e.target.value) };
                              return { ...f, departamentos: deps };
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              departamentos: f.departamentos.filter((x) => x.id !== d.id),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="padrao">Número de transferência padrão</Label>
                    <Input
                      id="padrao"
                      value={form.padrao}
                      placeholder="+5511999990000"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, padrao: formatarE164(e.target.value) }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado quando a pessoa pede um humano sem dizer o departamento.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => salvar.mutate()}
                      disabled={salvar.isPending || !atual.sip_trunk_id}
                    >
                      {salvar.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar configuração
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
