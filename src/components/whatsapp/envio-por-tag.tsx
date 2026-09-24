import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  enviarModeloParaTagWhatsapp,
  enviarParaTagWhatsapp,
  listarTagsWhatsapp,
} from "@/lib/whatsapp-tags.functions";

type Numero = { phone_number_id: string; display_phone_number: string | null; verified_name: string | null };
type Tipo = "template" | "text" | "audio" | "video" | "image";
type ComponenteModelo = { type: string; text?: string; format?: string };
export type ModeloAprovado = {
  id: string;
  wabaId?: string;
  name: string;
  language: string;
  components: ComponenteModelo[];
};

function lerBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(arquivo);
  });
}

function corpoDoModelo(m?: ModeloAprovado) {
  return m?.components.find((c) => c.type === "BODY")?.text ?? "";
}

function headerDoModelo(m?: ModeloAprovado) {
  const f = m?.components.find((c) => c.type === "HEADER")?.format ?? "";
  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(f)
    ? (f.toLowerCase() as "image" | "video" | "document")
    : null;
}

export function EnvioPorTag({ numeros, modelos }: { numeros: Numero[]; modelos: ModeloAprovado[] }) {
  const carregarTags = useServerFn(listarTagsWhatsapp);
  const enviar = useServerFn(enviarParaTagWhatsapp);
  const enviarModelo = useServerFn(enviarModeloParaTagWhatsapp);
  const tags = useQuery({ queryKey: ["whatsapp-tags"], queryFn: () => carregarTags() });

  const [numero, setNumero] = useState("");
  const [tagId, setTagId] = useState("");
  const [tipo, setTipo] = useState<Tipo>("template");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modeloNome, setModeloNome] = useState("");
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const [linkArquivo, setLinkArquivo] = useState("");

  const numeroAtual = numero || numeros[0]?.phone_number_id || "";
  const contagem = (tags.data?.vinculos ?? []).filter((v) => v.tag_id === tagId).length;
  const modelo = modelos.find((m) => m.name === modeloNome);
  const qtdVariaveis = (corpoDoModelo(modelo).match(/\{\{\s*\d+\s*\}\}/g) ?? []).length;
  const header = headerDoModelo(modelo);

  const envio = useMutation({
    mutationFn: async () => {
      if (tipo === "template") {
        return enviarModelo({
          data: {
            tagId,
            phoneNumberId: numeroAtual,
            templateName: modeloNome,
            templateLang: modelo?.language ?? "pt_BR",
            variaveis: variaveis.slice(0, qtdVariaveis),
            header: header && linkArquivo ? { tipo: header, link: linkArquivo } : null,
          },
        });
      }
      const dados = arquivo ? await lerBase64(arquivo) : null;
      return enviar({
        data: {
          tagId,
          phoneNumberId: numeroAtual,
          tipo,
          texto: texto.trim() || null,
          mimeType: arquivo?.type || null,
          nomeArquivo: arquivo?.name || null,
          dadosBase64: dados,
        },
      });
    },
    onSuccess: (r) => {
      const msg =
        `Enviado para ${r.enviados} de ${r.total}.` +
        (r.foraDaJanela
          ? ` ${r.foraDaJanela} não receberam: o contato não escreve há mais de 24h (use "Modelo aprovado").`
          : "") +
        (r.falhas.length ? ` ${r.falhas.length} falharam: ${r.falhas[0]}` : "");
      if (r.enviados === 0) toast.error(msg);
      else if (r.foraDaJanela || r.falhas.length) toast.warning(msg);
      else toast.success(msg);
      setTexto("");
      setArquivo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aceita = tipo === "audio" ? "audio/mpeg,audio/mp4,audio/ogg,audio/aac,audio/amr" : tipo === "video" ? "video/mp4,video/3gpp" : "image/jpeg,image/png";
  const conteudoOk =
    tipo === "template"
      ? Boolean(modeloNome) &&
        variaveis.slice(0, qtdVariaveis).filter((v) => v?.trim()).length === qtdVariaveis &&
        (!header || Boolean(linkArquivo.trim()))
      : tipo === "text"
        ? Boolean(texto.trim())
        : Boolean(arquivo);
  const podeEnviar = tagId && numeroAtual && conteudoOk && !envio.isPending;

  return (
    <Card className="border-border/60 bg-card/70">
      <CardHeader>
        <CardTitle className="text-base">Enviar para uma tag</CardTitle>
        <p className="text-xs text-muted-foreground">
          Use um modelo aprovado para alcançar todos os contatos da tag. Mensagens livres (texto, áudio, vídeo,
          imagem) só chegam a quem falou com você nas últimas 24 horas.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Número remetente</Label>
          <Select value={numeroAtual} onValueChange={setNumero}>
            <SelectTrigger><SelectValue placeholder="Escolha o número" /></SelectTrigger>
            <SelectContent>
              {numeros.map((n) => (
                <SelectItem key={n.phone_number_id} value={n.phone_number_id}>
                  {n.display_phone_number ?? n.verified_name ?? n.phone_number_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tag</Label>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger><SelectValue placeholder={tags.data?.tags.length ? "Escolha a tag" : "Nenhuma tag criada"} /></SelectTrigger>
            <SelectContent>
              {(tags.data?.tags ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tagId ? <p className="text-xs text-muted-foreground">{contagem} conversa(s) com esta tag.</p> : null}
          {tags.data?.aviso ? <p className="text-xs text-destructive">{tags.data.aviso}</p> : null}
        </div>
        <div className="space-y-2">
          <Label>Tipo de mensagem</Label>
          <Select value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setArquivo(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="template">Modelo aprovado (qualquer contato)</SelectItem>
              <SelectItem value="text">Texto (últimas 24h)</SelectItem>
              <SelectItem value="audio">Áudio (últimas 24h)</SelectItem>
              <SelectItem value="video">Vídeo (últimas 24h)</SelectItem>
              <SelectItem value="image">Imagem (últimas 24h)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipo === "template" ? (
          <>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select
                value={modeloNome}
                onValueChange={(v) => { setModeloNome(v); setVariaveis([]); setLinkArquivo(""); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={modelos.length ? "Escolha um modelo aprovado" : "Nenhum modelo aprovado"} />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={`${m.wabaId ?? ""}-${m.id}`} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {modelo ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3 md:col-span-2">
                <p className="whitespace-pre-wrap text-sm">{corpoDoModelo(modelo)}</p>
                {Array.from({ length: qtdVariaveis }).map((_, i) => (
                  <Input
                    key={i}
                    placeholder={`Valor para {{${i + 1}}}`}
                    value={variaveis[i] ?? ""}
                    onChange={(e) => {
                      const novo = [...variaveis];
                      novo[i] = e.target.value;
                      setVariaveis(novo);
                    }}
                  />
                ))}
                {header ? (
                  <Input
                    placeholder={`Link do arquivo (${header})`}
                    value={linkArquivo}
                    onChange={(e) => setLinkArquivo(e.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {tipo !== "text" ? (
              <div className="space-y-2">
                <Label>Arquivo (até 16 MB)</Label>
                <Input type="file" accept={aceita} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </div>
            ) : null}
            {tipo !== "audio" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{tipo === "text" ? "Mensagem" : "Legenda (opcional)"}</Label>
                <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={4000} />
              </div>
            ) : null}
          </>
        )}

        <div className="md:col-span-2 flex justify-end">
          <Button disabled={!podeEnviar} onClick={() => envio.mutate()}>
            {envio.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            {envio.isPending ? "Enviando..." : "Enviar para a tag"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
