import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Bell, Loader2, Play, Plus, Send, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  criarCampanhaWhatsapp,
  excluirCampanhaWhatsapp,
  excluirLembreteWhatsapp,
  listarCampanhasWhatsapp,
  listarLembretesWhatsapp,
  processarCampanhaAgora,
  salvarLembreteWhatsapp,
} from "@/lib/whatsapp-disparos.functions";
import {
  listarTemplatesWhatsapp,
  type ComponenteTemplate,
} from "@/lib/whatsapp-templates.functions";
import { listarNumerosWhatsapp } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp-disparos")({
  head: () => ({
    meta: [
      { title: "Disparos de WhatsApp — Omniasyn" },
      {
        name: "description",
        content: "Crie campanhas em massa e lembretes agendados pelo WhatsApp oficial.",
      },
      { property: "og:title", content: "Disparos de WhatsApp — Omniasyn" },
      {
        property: "og:description",
        content: "Suba sua lista em CSV e dispare modelos aprovados para todos os contatos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DisparosPage,
});

type LinhaCsv = Record<string, string>;

function normalizarTelefone(valor: string) {
  const digitos = (valor ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

function contarVariaveis(texto: string) {
  return (texto.match(/\{\{\s*\d+\s*\}\}/g) ?? []).length;
}

function corpoDoTemplate(components: ComponenteTemplate[]) {
  const corpo = components.find((c) => c.type === "BODY");
  return corpo?.text ?? "";
}

function formatoDoHeader(components: ComponenteTemplate[]) {
  const header = components.find((c) => c.type === "HEADER");
  const formato = header?.format ?? "";
  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(formato)
    ? (formato.toLowerCase() as "image" | "video" | "document")
    : null;
}

function DisparosPage() {
  const queryClient = useQueryClient();
  const numeros = useQuery({ queryKey: ["whatsapp-numeros"], queryFn: () => listarNumerosWhatsapp() });
  const templates = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: () => listarTemplatesWhatsapp(),
  });
  const campanhas = useQuery({
    queryKey: ["whatsapp-campanhas"],
    queryFn: () => listarCampanhasWhatsapp(),
    refetchInterval: 5000,
  });
  const lembretes = useQuery({
    queryKey: ["whatsapp-lembretes"],
    queryFn: () => listarLembretesWhatsapp(),
  });

  const aprovados = useMemo(
    () => (templates.data ?? []).filter((t) => t.status === "APPROVED"),
    [templates.data],
  );

  /* ----------------------------- Campanha ----------------------------- */
  const [campanhaAberta, setCampanhaAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [templateCampanha, setTemplateCampanha] = useState("");
  const [agendamento, setAgendamento] = useState("");
  const [linhas, setLinhas] = useState<LinhaCsv[]>([]);
  const [colunas, setColunas] = useState<string[]>([]);
  const [colunaNome, setColunaNome] = useState("");
  const [colunaTelefone, setColunaTelefone] = useState("");
  const [mapeamento, setMapeamento] = useState<string[]>([]);
  const [linkArquivo, setLinkArquivo] = useState("");
  const inputCsv = useRef<HTMLInputElement>(null);

  const templateSelecionado = aprovados.find((t) => t.name === templateCampanha);
  const variaveisCampanha = templateSelecionado
    ? contarVariaveis(corpoDoTemplate(templateSelecionado.components))
    : 0;
  const headerCampanha = templateSelecionado
    ? formatoDoHeader(templateSelecionado.components)
    : null;

  const contatosValidos = useMemo(() => {
    if (!colunaTelefone) return [];
    return linhas
      .map((linha) => {
        const telefone = normalizarTelefone(linha[colunaTelefone] ?? "");
        if (!telefone) return null;
        return {
          nome: colunaNome ? (linha[colunaNome] ?? null) : null,
          telefone,
          variaveis: Array.from({ length: variaveisCampanha }).map((_, indice) => {
            const coluna = mapeamento[indice];
            return coluna ? (linha[coluna] ?? "") : "";
          }),
        };
      })
      .filter((c): c is { nome: string | null; telefone: string; variaveis: string[] } => Boolean(c));
  }, [linhas, colunaTelefone, colunaNome, mapeamento, variaveisCampanha]);

  function lerCsv(file: File) {
    Papa.parse<LinhaCsv>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        const dados = (resultado.data ?? []).filter(Boolean);
        const campos = resultado.meta.fields ?? [];
        setLinhas(dados);
        setColunas(campos);
        setColunaNome(campos.find((c) => /nome|name/i.test(c)) ?? campos[0] ?? "");
        setColunaTelefone(campos.find((c) => /tel|fone|phone|whats/i.test(c)) ?? campos[1] ?? "");
        toast.success(`${dados.length} contato(s) carregado(s).`);
      },
      error: () => toast.error("Não foi possível ler o arquivo CSV."),
    });
  }

  const criarCampanha = useMutation({
    mutationFn: () =>
      criarCampanhaWhatsapp({
        data: {
          nome,
          phoneNumberId,
          templateName: templateCampanha,
          templateLang: templateSelecionado?.language ?? "pt_BR",
          header: headerCampanha && linkArquivo ? { tipo: headerCampanha, link: linkArquivo } : null,
          agendadaPara: agendamento ? new Date(agendamento).toISOString() : null,
          contatos: contatosValidos,
        },
      }),
    onSuccess: () => {
      toast.success(agendamento ? "Campanha agendada." : "Campanha iniciada.");
      setCampanhaAberta(false);
      setNome("");
      setLinhas([]);
      setColunas([]);
      setAgendamento("");
      setLinkArquivo("");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-campanhas"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const removerCampanha = useMutation({
    mutationFn: (id: string) => excluirCampanhaWhatsapp({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["whatsapp-campanhas"] }),
    onError: (erro: Error) => toast.error(erro.message),
  });

  const continuarCampanha = useMutation({
    mutationFn: (id: string) => processarCampanhaAgora({ data: { id } }),
    onSuccess: () => {
      toast.success("Envio retomado.");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-campanhas"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  /* ----------------------------- Lembretes ----------------------------- */
  const [lembreteAberto, setLembreteAberto] = useState(false);
  const [lembreteNome, setLembreteNome] = useState("");
  const [lembreteTelefone, setLembreteTelefone] = useState("");
  const [lembreteNumero, setLembreteNumero] = useState("");
  const [lembreteTemplate, setLembreteTemplate] = useState("");
  const [lembreteVariaveis, setLembreteVariaveis] = useState<string[]>([]);
  const [lembreteArquivo, setLembreteArquivo] = useState("");
  const [lembreteData, setLembreteData] = useState("");

  const templateLembrete = aprovados.find((t) => t.name === lembreteTemplate);
  const variaveisLembrete = templateLembrete
    ? contarVariaveis(corpoDoTemplate(templateLembrete.components))
    : 0;
  const headerLembrete = templateLembrete ? formatoDoHeader(templateLembrete.components) : null;

  const salvarLembrete = useMutation({
    mutationFn: () =>
      salvarLembreteWhatsapp({
        data: {
          id: null,
          nome: lembreteNome,
          telefone: normalizarTelefone(lembreteTelefone) ?? lembreteTelefone,
          phoneNumberId: lembreteNumero,
          templateName: lembreteTemplate,
          templateLang: templateLembrete?.language ?? "pt_BR",
          variaveis: lembreteVariaveis.slice(0, variaveisLembrete),
          header:
            headerLembrete && lembreteArquivo
              ? { tipo: headerLembrete, link: lembreteArquivo }
              : null,
          agendadoPara: lembreteData,
        },
      }),
    onSuccess: () => {
      toast.success("Lembrete agendado.");
      setLembreteAberto(false);
      setLembreteNome("");
      setLembreteTelefone("");
      setLembreteVariaveis([]);
      setLembreteArquivo("");
      setLembreteData("");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-lembretes"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const removerLembrete = useMutation({
    mutationFn: (id: string) => excluirLembreteWhatsapp({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["whatsapp-lembretes"] }),
    onError: (erro: Error) => toast.error(erro.message),
  });

  const listaNumeros = numeros.data ?? [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Disparos</h1>
          <p className="text-sm text-muted-foreground">
            Campanhas em massa e lembretes agendados usando seus modelos aprovados.
          </p>
        </div>

        <Tabs defaultValue="campanhas">
          <TabsList>
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
            <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setPhoneNumberId(listaNumeros[0]?.phone_number_id ?? "");
                  setCampanhaAberta(true);
                }}
                disabled={listaNumeros.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova campanha
              </Button>
            </div>

            {(campanhas.data ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <Send className="mx-auto mb-2 h-6 w-6" />
                  Nenhuma campanha criada ainda.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(campanhas.data ?? []).map((campanha) => {
                  const total = campanha.total || 1;
                  const progresso = Math.round(
                    ((campanha.enviados + campanha.falhas) / total) * 100,
                  );
                  return (
                    <Card key={campanha.id}>
                      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{campanha.nome}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Modelo {campanha.template_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {campanha.status !== "concluida" ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => continuarCampanha.mutate(campanha.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removerCampanha.mutate(campanha.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary">{campanha.status}</Badge>
                          {campanha.agendada_para ? (
                            <span className="text-muted-foreground">
                              {new Date(campanha.agendada_para).toLocaleString("pt-BR")}
                            </span>
                          ) : null}
                        </div>
                        <Progress value={progresso} />
                        <p className="text-xs text-muted-foreground">
                          {campanha.enviados} enviados · {campanha.falhas} falhas · {campanha.total}{" "}
                          contatos
                        </p>
                        {campanha.erro ? (
                          <p className="text-xs text-destructive">{campanha.erro}</p>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="lembretes" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setLembreteNumero(listaNumeros[0]?.phone_number_id ?? "");
                  setLembreteAberto(true);
                }}
                disabled={listaNumeros.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo lembrete
              </Button>
            </div>

            {(lembretes.data ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-6 w-6" />
                  Nenhum lembrete agendado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {(lembretes.data ?? []).map((lembrete) => (
                  <Card key={lembrete.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{lembrete.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {lembrete.telefone} · modelo {lembrete.template_name} ·{" "}
                          {new Date(lembrete.agendado_para).toLocaleString("pt-BR")}
                        </p>
                        {lembrete.erro ? (
                          <p className="text-xs text-destructive">{lembrete.erro}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{lembrete.status}</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removerLembrete.mutate(lembrete.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Nova campanha */}
      <Dialog open={campanhaAberta} onOpenChange={setCampanhaAberta}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
            <DialogDescription>
              Suba a lista em CSV com nome e número e escolha o modelo aprovado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome da campanha</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Número remetente</Label>
                <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o número" />
                  </SelectTrigger>
                  <SelectContent>
                    {listaNumeros.map((numero) => (
                      <SelectItem key={numero.phone_number_id} value={numero.phone_number_id}>
                        {numero.display_phone_number ?? numero.phone_number_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Select value={templateCampanha} onValueChange={setTemplateCampanha}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um modelo aprovado" />
                  </SelectTrigger>
                  <SelectContent>
                    {aprovados.map((template) => (
                      <SelectItem key={`${template.wabaId}-${template.id}`} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {aprovados.length === 0 ? (
                  <p className="text-xs text-destructive">
                    Nenhum modelo aprovado ainda. Crie um em Modelos.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Agendar (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={agendamento}
                  onChange={(e) => setAgendamento(e.target.value)}
                />
              </div>
            </div>

            {headerCampanha ? (
              <div className="space-y-1.5">
                <Label>Link do arquivo do título ({headerCampanha})</Label>
                <Input
                  placeholder="https://..."
                  value={linkArquivo}
                  onChange={(e) => setLinkArquivo(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Lista de contatos (CSV)</Label>
              <input
                ref={inputCsv}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) lerCsv(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => inputCsv.current?.click()}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Escolher arquivo
              </Button>
              {colunas.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coluna do nome</Label>
                    <Select value={colunaNome} onValueChange={setColunaNome}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colunas.map((coluna) => (
                          <SelectItem key={coluna} value={coluna}>
                            {coluna}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coluna do número</Label>
                    <Select value={colunaTelefone} onValueChange={setColunaTelefone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colunas.map((coluna) => (
                          <SelectItem key={coluna} value={coluna}>
                            {coluna}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {variaveisCampanha > 0 && colunas.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs">Variáveis do modelo</Label>
                  {Array.from({ length: variaveisCampanha }).map((_, indice) => (
                    <div key={indice} className="flex items-center gap-2">
                      <span className="w-14 text-xs text-muted-foreground">{`{{${indice + 1}}}`}</span>
                      <Select
                        value={mapeamento[indice] ?? ""}
                        onValueChange={(valor) => {
                          const novo = [...mapeamento];
                          novo[indice] = valor;
                          setMapeamento(novo);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Coluna do CSV" />
                        </SelectTrigger>
                        <SelectContent>
                          {colunas.map((coluna) => (
                            <SelectItem key={coluna} value={coluna}>
                              {coluna}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              ) : null}

              {linhas.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {contatosValidos.length} número(s) válido(s) de {linhas.length} linha(s).
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCampanhaAberta(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarCampanha.mutate()}
              disabled={
                criarCampanha.isPending ||
                contatosValidos.length === 0 ||
                !templateCampanha ||
                !phoneNumberId ||
                nome.trim().length < 2
              }
            >
              {criarCampanha.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {agendamento ? "Agendar campanha" : "Disparar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo lembrete */}
      <Dialog open={lembreteAberto} onOpenChange={setLembreteAberto}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo lembrete</DialogTitle>
            <DialogDescription>
              Escolha o modelo para liberar os campos da mensagem e marque a data do envio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={lembreteNome} onChange={(e) => setLembreteNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input
                  value={lembreteTelefone}
                  placeholder="(11) 99999-9999"
                  onChange={(e) => setLembreteTelefone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Enviar pelo número</Label>
                <Select value={lembreteNumero} onValueChange={setLembreteNumero}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {listaNumeros.map((numero) => (
                      <SelectItem key={numero.phone_number_id} value={numero.phone_number_id}>
                        {numero.display_phone_number ?? numero.phone_number_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={lembreteData}
                  onChange={(e) => setLembreteData(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select
                value={lembreteTemplate}
                onValueChange={(valor) => {
                  setLembreteTemplate(valor);
                  setLembreteVariaveis([]);
                  setLembreteArquivo("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um modelo aprovado" />
                </SelectTrigger>
                <SelectContent>
                  {aprovados.map((template) => (
                    <SelectItem key={`${template.wabaId}-${template.id}`} value={template.name}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {templateLembrete ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="whitespace-pre-wrap text-sm">
                  {corpoDoTemplate(templateLembrete.components)}
                </p>
                {Array.from({ length: variaveisLembrete }).map((_, indice) => (
                  <Input
                    key={indice}
                    placeholder={`Valor para {{${indice + 1}}}`}
                    value={lembreteVariaveis[indice] ?? ""}
                    onChange={(e) => {
                      const novo = [...lembreteVariaveis];
                      novo[indice] = e.target.value;
                      setLembreteVariaveis(novo);
                    }}
                  />
                ))}
                {headerLembrete ? (
                  <Input
                    placeholder={`Link do arquivo (${headerLembrete})`}
                    value={lembreteArquivo}
                    onChange={(e) => setLembreteArquivo(e.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLembreteAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvarLembrete.mutate()}
              disabled={
                salvarLembrete.isPending ||
                !lembreteTemplate ||
                !lembreteData ||
                lembreteNome.trim().length < 2 ||
                !lembreteTelefone
              }
            >
              {salvarLembrete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Agendar lembrete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
