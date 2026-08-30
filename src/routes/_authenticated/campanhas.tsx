import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import {
  Megaphone,
  Plus,
  Loader2,
  UploadCloud,
  FileText,
  X,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  criarCampanha,
  listarCampanhas,
  listarLinhasSip,
  type LinhaSip,
} from "@/lib/ligacao.functions";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — Omniasyn" },
      {
        name: "description",
        content: "Crie e acompanhe campanhas de discagem automática.",
      },
      { property: "og:title", content: "Campanhas — Omniasyn" },
      {
        property: "og:description",
        content: "Crie e acompanhe campanhas de discagem automática.",
      },
    ],
  }),
  component: CampanhasPage,
});

const E164_RE = /^\+[1-9]\d{7,14}$/;

type ContatoCampanha = {
  nome: string;
  telefone: string;
};

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  ativa: { label: "Ativa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  concluida: { label: "Concluída", variant: "secondary" },
};

function metaStatus(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      variant: "outline" as const,
    }
  );
}

function normalizarTelefone(valor: string): string {
  const limpo = valor.replace(/[^\d+]/g, "");
  if (limpo.startsWith("+")) return limpo;
  if (limpo.startsWith("55") && limpo.length >= 12) return `+${limpo}`;
  if (limpo.length >= 10 && limpo.length <= 11) return `+55${limpo}`;
  return limpo ? `+${limpo}` : "";
}

function parseCsvContatos(file: File): Promise<ContatoCampanha[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const contatos: ContatoCampanha[] = [];
        const vistos = new Set<string>();

        for (const row of results.data) {
          const nome = (row.nome ?? row.name ?? "").trim();
          const bruto = (
            row.telefone ??
            row.phone ??
            row.numero ??
            row["número"] ??
            ""
          ).trim();
          if (!bruto) continue;
          const telefone = normalizarTelefone(bruto);
          if (!E164_RE.test(telefone)) continue;
          if (vistos.has(telefone)) continue;
          vistos.add(telefone);
          contatos.push({ nome: nome || telefone, telefone });
        }

        if (contatos.length === 0) {
          reject(
            new Error(
              "Nenhum telefone válido encontrado. O CSV precisa de colunas 'nome' e 'telefone'.",
            ),
          );
          return;
        }
        resolve(contatos);
      },
      error: (err) => reject(new Error(`Falha ao ler o CSV: ${err.message}`)),
    });
  });
}

function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);

  // Formulário
  const [nome, setNome] = useState("");
  const [linhaId, setLinhaId] = useState("");
  const [simultaneas, setSimultaneas] = useState("2");
  const [contatos, setContatos] = useState<ContatoCampanha[]>([]);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [lendoCsv, setLendoCsv] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const linhasQuery = useQuery({
    queryKey: ["linhas-sip"],
    queryFn: async () => {
      const r = await listarLinhasSip();
      return r.ok ? r.linhas : ([] as LinhaSip[]);
    },
    retry: false,
  });
  const linhas = linhasQuery.data ?? [];

  const resetarFormulario = () => {
    setNome("");
    setLinhaId("");
    setSimultaneas("2");
    setContatos([]);
    setArquivoNome(null);
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  };

  const processarArquivo = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Envie apenas arquivos .csv");
      return;
    }
    setLendoCsv(true);
    try {
      const lista = await parseCsvContatos(file);
      setContatos(lista);
      setArquivoNome(file.name);
      toast.success(`${lista.length} contato(s) válido(s) importados.`);
    } catch (e) {
      toast.error((e as Error).message);
      setContatos([]);
      setArquivoNome(null);
    } finally {
      setLendoCsv(false);
    }
  }, []);

  const aoSoltarArquivo = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processarArquivo(file);
  };

  const removerArquivo = () => {
    setContatos([]);
    setArquivoNome(null);
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  };

  const podeCriar =
    nome.trim().length > 0 &&
    linhaId.length > 0 &&
    Number(simultaneas) >= 1 &&
    contatos.length > 0;

  const criarCampanha = () => {
    if (!podeCriar) return;
    const linha = linhas.find((l) => l.id === linhaId);
    const nova: Campanha = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      linha_sip_id: linhaId,
      linha_sip_nome: linha?.nome_identificacao ?? "Linha",
      simultaneas: Math.max(1, Math.floor(Number(simultaneas))),
      contatos,
      status: "rascunho",
      progresso: 0,
    };
    // Estado local por enquanto — payload pronto para enviar à API futuramente.
    setCampanhas((prev) => [nova, ...prev]);
    toast.success("Campanha criada como rascunho!", {
      description: `${nova.contatos.length} contatos prontos para discagem.`,
    });
    resetarFormulario();
    setDialogAberto(false);
  };

  const alternarStatus = (campanha: Campanha) => {
    setCampanhas((prev) =>
      prev.map((c) => {
        if (c.id !== campanha.id) return c;
        if (c.status === "rascunho") return { ...c, status: "ativa" };
        if (c.status === "ativa") return { ...c, status: "pausada" };
        if (c.status === "pausada") return { ...c, status: "ativa" };
        return c;
      }),
    );
  };

  return (
    <DashboardShell>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Campanhas
            </h1>
            <p className="text-sm text-muted-foreground">
              Discador automático: crie campanhas a partir de uma lista CSV.
            </p>
          </div>

          <Dialog
            open={dialogAberto}
            onOpenChange={(open) => {
              setDialogAberto(open);
              if (!open) resetarFormulario();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova campanha</DialogTitle>
                <DialogDescription>
                  Defina o nome, a linha de origem e envie o CSV de contatos.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nome-campanha">Nome da campanha</Label>
                  <Input
                    id="nome-campanha"
                    placeholder="Ex: Recuperação de carrinho — Setembro"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Tronco SIP de origem</Label>
                    <Select value={linhaId} onValueChange={setLinhaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a linha" />
                      </SelectTrigger>
                      <SelectContent>
                        {linhasQuery.isLoading ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Carregando…
                          </div>
                        ) : linhas.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Nenhuma linha cadastrada. Crie uma na página
                            Ligação.
                          </div>
                        ) : (
                          linhas.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.nome_identificacao} ({l.telefone_associado})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="simultaneas">Ligações simultâneas</Label>
                    <Input
                      id="simultaneas"
                      type="number"
                      min={1}
                      max={50}
                      value={simultaneas}
                      onChange={(e) => setSimultaneas(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Lista de contatos (.csv)</Label>
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processarArquivo(file);
                    }}
                  />

                  {arquivoNome ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {arquivoNome}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <Users className="mr-1 inline h-3 w-3" />
                            {contatos.length} contato(s) válido(s)
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={removerArquivo}
                        aria-label="Remover arquivo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => inputArquivoRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setArrastando(true);
                      }}
                      onDragLeave={() => setArrastando(false)}
                      onDrop={aoSoltarArquivo}
                      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                        arrastando
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      {lendoCsv ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <UploadCloud className="h-6 w-6 text-muted-foreground" />
                      )}
                      <p className="text-sm text-muted-foreground">
                        {lendoCsv
                          ? "Lendo arquivo…"
                          : "Arraste o CSV aqui ou clique para selecionar"}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Colunas esperadas: nome, telefone
                      </p>
                    </button>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogAberto(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={criarCampanha} disabled={!podeCriar}>
                  Criar campanha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Suas campanhas
            </CardTitle>
            <CardDescription>
              Acompanhe o status e o progresso de cada discagem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campanhas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">
                  Nenhuma campanha criada ainda
                </p>
                <p className="text-sm text-muted-foreground">
                  Clique em "Nova campanha" e importe seu primeiro CSV.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead className="text-center">Contatos</TableHead>
                      <TableHead className="text-center">Simultâneas</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campanhas.map((c) => {
                      const meta = STATUS_META[c.status];
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            {c.nome}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.linha_sip_nome}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.contatos.length}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.simultaneas}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <Progress value={c.progresso} className="h-2" />
                              <span className="w-9 text-right text-xs text-muted-foreground">
                                {c.progresso}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.status === "concluida" ? (
                              <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => alternarStatus(c)}
                                aria-label={
                                  c.status === "ativa"
                                    ? "Pausar campanha"
                                    : "Iniciar campanha"
                                }
                              >
                                {c.status === "ativa" ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
