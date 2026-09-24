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
import { enviarParaTagWhatsapp, listarTagsWhatsapp } from "@/lib/whatsapp-tags.functions";

type Numero = { phone_number_id: string; display_phone_number: string | null; verified_name: string | null };
type Tipo = "text" | "audio" | "video" | "image";

function lerBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(arquivo);
  });
}

export function EnvioPorTag({ numeros }: { numeros: Numero[] }) {
  const carregarTags = useServerFn(listarTagsWhatsapp);
  const enviar = useServerFn(enviarParaTagWhatsapp);
  const tags = useQuery({ queryKey: ["whatsapp-tags"], queryFn: () => carregarTags() });

  const [numero, setNumero] = useState("");
  const [tagId, setTagId] = useState("");
  const [tipo, setTipo] = useState<Tipo>("text");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const numeroAtual = numero || numeros[0]?.phone_number_id || "";
  const contagem = (tags.data?.vinculos ?? []).filter((v) => v.tag_id === tagId).length;

  const envio = useMutation({
    mutationFn: async () => {
      const dados = arquivo && tipo !== "text" ? await lerBase64(arquivo) : null;
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
      toast.success(
        `Enviado para ${r.enviados} de ${r.total}.` +
          (r.foraDaJanela ? ` ${r.foraDaJanela} fora da janela de 24h (use um modelo em Campanhas).` : "") +
          (r.falhas.length ? ` ${r.falhas.length} falharam.` : ""),
      );
      setTexto("");
      setArquivo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aceita = tipo === "audio" ? "audio/mpeg,audio/mp4,audio/ogg,audio/aac,audio/amr" : tipo === "video" ? "video/mp4,video/3gpp" : "image/jpeg,image/png";
  const podeEnviar = tagId && numeroAtual && (tipo === "text" ? texto.trim() : arquivo) && !envio.isPending;

  return (
    <Card className="border-border/60 bg-card/70">
      <CardHeader>
        <CardTitle className="text-base">Enviar para uma tag</CardTitle>
        <p className="text-xs text-muted-foreground">
          Envia uma mensagem para todas as conversas marcadas com a tag. Pelas regras da Meta, mensagens
          livres só chegam a quem falou com você nas últimas 24 horas; para os demais, use uma campanha com modelo.
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
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
