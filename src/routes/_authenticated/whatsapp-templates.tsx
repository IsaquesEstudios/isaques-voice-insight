import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  criarTemplateWhatsapp,
  enviarArquivoTemplate,
  excluirTemplateWhatsapp,
  listarTemplatesWhatsapp,
} from "@/lib/whatsapp-templates.functions";
import { listarNumerosWhatsapp } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp-templates")({
  head: () => ({
    meta: [
      { title: "Modelos de mensagem do WhatsApp — Omniasyn" },
      {
        name: "description",
        content: "Crie e acompanhe os modelos oficiais de mensagem da sua conta do WhatsApp.",
      },
      { property: "og:title", content: "Modelos de mensagem do WhatsApp — Omniasyn" },
      {
        property: "og:description",
        content: "Cadastre modelos aprovados pela Meta direto do painel Omniasyn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

const CATEGORIAS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

const STATUS: Record<string, { texto: string; cor: string }> = {
  APPROVED: { texto: "Aprovado", cor: "bg-emerald-500/15 text-emerald-600" },
  PENDING: { texto: "Em análise", cor: "bg-amber-500/15 text-amber-600" },
  REJECTED: { texto: "Rejeitado", cor: "bg-destructive/15 text-destructive" },
  PAUSED: { texto: "Pausado", cor: "bg-muted text-muted-foreground" },
  DISABLED: { texto: "Desativado", cor: "bg-muted text-muted-foreground" },
};

type Botao =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; example: string };

type Form = {
  wabaId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  headerTipo: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  headerTexto: string;
  headerExemplo: string;
  headerHandle: string;
  headerArquivo: string;
  body: string;
  bodyExemplos: string[];
  footer: string;
  botoes: Botao[];
};

const vazio: Form = {
  wabaId: "",
  name: "",
  language: "pt_BR",
  category: "MARKETING",
  headerTipo: "NONE",
  headerTexto: "",
  headerExemplo: "",
  headerHandle: "",
  headerArquivo: "",
  body: "",
  bodyExemplos: [],
  footer: "",
  botoes: [],
};

function contarVariaveis(texto: string) {
  return (texto.match(/\{\{\s*\d+\s*\}\}/g) ?? []).length;
}

function arquivoParaBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function TemplatesPage() {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(vazio);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const numeros = useQuery({ queryKey: ["whatsapp-numeros"], queryFn: () => listarNumerosWhatsapp() });
  const templates = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: () => listarTemplatesWhatsapp(),
  });

  const contas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const numero of numeros.data ?? []) {
      if (!mapa.has(numero.waba_id)) {
        mapa.set(numero.waba_id, numero.display_phone_number ?? numero.waba_id);
      }
    }
    return [...mapa.entries()].map(([id, rotulo]) => ({ id, rotulo }));
  }, [numeros.data]);

  const criar = useMutation({
    mutationFn: async () => {
      const variaveis = contarVariaveis(form.body);
      return criarTemplateWhatsapp({
        data: {
          wabaId: form.wabaId || contas[0]?.id || "",
          name: form.name.trim().toLowerCase().replace(/\s+/g, "_"),
          language: form.language,
          category: form.category,
          headerTipo: form.headerTipo,
          headerTexto: form.headerTexto || undefined,
          headerExemplo: form.headerExemplo || undefined,
          headerHandle: form.headerHandle || undefined,
          body: form.body,
          bodyExemplos: form.bodyExemplos.slice(0, variaveis),
          footer: form.footer || undefined,
          botoes: form.botoes,
        },
      });
    },
    onSuccess: () => {
      toast.success("Modelo enviado para análise da Meta.");
      setAberto(false);
      setForm(vazio);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const excluir = useMutation({
    mutationFn: (dados: { wabaId: string; name: string }) =>
      excluirTemplateWhatsapp({ data: dados }),
    onSuccess: () => {
      toast.success("Modelo excluído.");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await arquivoParaBase64(file);
      const resposta = await enviarArquivoTemplate({
        data: { nome: file.name, mimeType: file.type, dadosBase64: base64 },
      });
      return { handle: resposta.handle, nome: file.name };
    },
    onSuccess: (dados) => {
      setForm((atual) => ({ ...atual, headerHandle: dados.handle, headerArquivo: dados.nome }));
      toast.success("Arquivo de exemplo enviado.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const variaveisCorpo = contarVariaveis(form.body);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Modelos de mensagem</h1>
            <p className="text-sm text-muted-foreground">
              Modelos oficiais da sua conta na Meta, usados nos disparos e lembretes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void templates.refetch()}
              disabled={templates.isFetching}
            >
              {templates.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
            <Button
              onClick={() => {
                setForm({ ...vazio, wabaId: contas[0]?.id ?? "" });
                setAberto(true);
              }}
              disabled={contas.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo modelo
            </Button>
          </div>
        </div>

        {contas.length === 0 && !numeros.isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Conecte um número de WhatsApp para gerenciar seus modelos.
            </CardContent>
          </Card>
        ) : null}

        {templates.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(templates.data ?? []).map((template) => {
              const estado = STATUS[template.status] ?? {
                texto: template.status,
                cor: "bg-muted text-muted-foreground",
              };
              const corpo = template.components.find((c) => c.type === "BODY");
              return (
                <Card key={`${template.wabaId}-${template.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{template.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{template.language}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        excluir.mutate({ wabaId: template.wabaId, name: template.name })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {CATEGORIAS[template.category] ?? template.category}
                      </Badge>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${estado.cor}`}>
                        {estado.texto}
                      </span>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                      {corpo?.text ?? "—"}
                    </p>
                    {template.motivo ? (
                      <p className="text-xs text-destructive">Motivo: {template.motivo}</p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
            {(templates.data ?? []).length === 0 && !templates.isLoading && contas.length > 0 ? (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-6 w-6" />
                  Nenhum modelo cadastrado ainda.
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo modelo</DialogTitle>
            <DialogDescription>
              A Meta analisa cada modelo antes de liberar o envio. Use variáveis como
              {" {{1}} "}
              para personalizar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Select
                  value={form.wabaId}
                  onValueChange={(valor) => setForm({ ...form, wabaId: valor })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome do modelo</Label>
                <Input
                  value={form.name}
                  placeholder="lembrete_consulta"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(valor: Form["category"]) => setForm({ ...form, category: valor })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utilidade</SelectItem>
                    <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select
                  value={form.language}
                  onValueChange={(valor) => setForm({ ...form, language: valor })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                    <SelectItem value="es_ES">Espanhol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Título (opcional)</Label>
              <Select
                value={form.headerTipo}
                onValueChange={(valor: Form["headerTipo"]) =>
                  setForm({ ...form, headerTipo: valor, headerHandle: "", headerArquivo: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem título</SelectItem>
                  <SelectItem value="TEXT">Texto</SelectItem>
                  <SelectItem value="IMAGE">Imagem</SelectItem>
                  <SelectItem value="VIDEO">Vídeo</SelectItem>
                  <SelectItem value="DOCUMENT">Documento</SelectItem>
                  <SelectItem value="LOCATION">Localização</SelectItem>
                </SelectContent>
              </Select>
              {form.headerTipo === "TEXT" ? (
                <div className="space-y-1.5 pt-2">
                  <Input
                    value={form.headerTexto}
                    placeholder="Ex.: Olá, {{1}}"
                    onChange={(e) => setForm({ ...form, headerTexto: e.target.value })}
                  />
                  {contarVariaveis(form.headerTexto) > 0 ? (
                    <Input
                      value={form.headerExemplo}
                      placeholder="Exemplo para a variável do título"
                      onChange={(e) => setForm({ ...form, headerExemplo: e.target.value })}
                    />
                  ) : null}
                </div>
              ) : null}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerTipo) ? (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    ref={inputArquivo}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) upload.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => inputArquivo.current?.click()}
                    disabled={upload.isPending}
                  >
                    {upload.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Arquivo de exemplo
                  </Button>
                  {form.headerArquivo ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {form.headerArquivo}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Corpo da mensagem</Label>
              <Textarea
                rows={5}
                value={form.body}
                placeholder="Olá {{1}}, sua consulta é em {{2}}."
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              {Array.from({ length: variaveisCorpo }).map((_, indice) => (
                <Input
                  key={indice}
                  value={form.bodyExemplos[indice] ?? ""}
                  placeholder={`Exemplo para {{${indice + 1}}}`}
                  onChange={(e) => {
                    const exemplos = [...form.bodyExemplos];
                    exemplos[indice] = e.target.value;
                    setForm({ ...form, bodyExemplos: exemplos });
                  }}
                />
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Rodapé (opcional)</Label>
              <Input
                value={form.footer}
                maxLength={60}
                onChange={(e) => setForm({ ...form, footer: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Botões (opcional)</Label>
              {form.botoes.map((botao, indice) => (
                <div key={indice} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {botao.type === "QUICK_REPLY"
                      ? "Resposta rápida"
                      : botao.type === "URL"
                        ? "Abrir site"
                        : botao.type === "PHONE_NUMBER"
                          ? "Ligar"
                          : "Copiar código"}
                  </span>
                  {botao.type !== "COPY_CODE" ? (
                    <Input
                      className="w-40"
                      placeholder="Texto do botão"
                      value={botao.text}
                      onChange={(e) => {
                        const botoes = [...form.botoes];
                        botoes[indice] = { ...botao, text: e.target.value } as Botao;
                        setForm({ ...form, botoes });
                      }}
                    />
                  ) : null}
                  {botao.type === "URL" ? (
                    <Input
                      className="w-56"
                      placeholder="https://..."
                      value={botao.url}
                      onChange={(e) => {
                        const botoes = [...form.botoes];
                        botoes[indice] = { ...botao, url: e.target.value };
                        setForm({ ...form, botoes });
                      }}
                    />
                  ) : null}
                  {botao.type === "PHONE_NUMBER" ? (
                    <Input
                      className="w-44"
                      placeholder="+5511999999999"
                      value={botao.phone_number}
                      onChange={(e) => {
                        const botoes = [...form.botoes];
                        botoes[indice] = { ...botao, phone_number: e.target.value };
                        setForm({ ...form, botoes });
                      }}
                    />
                  ) : null}
                  {botao.type === "COPY_CODE" ? (
                    <Input
                      className="w-44"
                      placeholder="Código de exemplo"
                      value={botao.example}
                      onChange={(e) => {
                        const botoes = [...form.botoes];
                        botoes[indice] = { ...botao, example: e.target.value };
                        setForm({ ...form, botoes });
                      }}
                    />
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setForm({ ...form, botoes: form.botoes.filter((_, i) => i !== indice) })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      botoes: [...form.botoes, { type: "QUICK_REPLY", text: "" }],
                    })
                  }
                >
                  Resposta rápida
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      botoes: [...form.botoes, { type: "URL", text: "", url: "" }],
                    })
                  }
                >
                  Abrir site
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      botoes: [...form.botoes, { type: "PHONE_NUMBER", text: "", phone_number: "" }],
                    })
                  }
                >
                  Ligar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({ ...form, botoes: [...form.botoes, { type: "COPY_CODE", example: "" }] })
                  }
                >
                  Copiar código
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Prévia</p>
              <div className="max-w-sm rounded-lg bg-background p-3 text-sm shadow-sm">
                {form.headerTipo === "TEXT" && form.headerTexto ? (
                  <p className="font-semibold">{form.headerTexto}</p>
                ) : null}
                <p className="whitespace-pre-wrap">{form.body || "Corpo da mensagem..."}</p>
                {form.footer ? (
                  <p className="mt-1 text-xs text-muted-foreground">{form.footer}</p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar para análise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
