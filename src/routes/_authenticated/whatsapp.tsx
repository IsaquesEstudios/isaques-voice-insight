import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Virtuoso } from "react-virtuoso";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Download, FileText, ImageIcon, Loader2, MessageCircle, Mic, Paperclip, Pause, Play, Search, Smartphone, Square, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import {
  enviarMensagemWhatsapp,
  enviarMidiaWhatsapp,
  obterMidiaWhatsapp,
  listarConversasWhatsapp,
  listarMensagensWhatsapp,
  listarNumerosWhatsapp,
} from "@/lib/whatsapp.functions";
import { setWhatsappConversationTakeover } from "@/lib/whatsapp-ai.functions";
import { salvarCacheImagemWhatsapp } from "@/lib/whatsapp.functions";
import {
  alternarTagConversa,
  criarTagWhatsapp,
  excluirConversaWhatsapp,
  listarTagsWhatsapp,
  excluirTagWhatsapp,
} from "@/lib/whatsapp-tags.functions";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Reduz bastante uma imagem (JPEG leve) para economizar espaço e dados. */
async function reduzirImagem(origem: Blob | string, ladoMax: number, qualidade: number): Promise<Blob> {
  const url = typeof origem === "string" ? origem : URL.createObjectURL(origem);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Imagem inválida."));
      el.src = url;
    });
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sem suporte a imagem.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao reduzir."))), "image/jpeg", qualidade),
    );
  } finally {
    if (typeof origem !== "string") URL.revokeObjectURL(url);
  }
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}


export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Omniasyn" },
      {
        name: "description",
        content:
          "Acompanhe e responda as conversas de WhatsApp da sua empresa direto no painel.",
      },
      { property: "og:title", content: "WhatsApp — Omniasyn" },
      {
        property: "og:description",
        content: "Conversas de WhatsApp da sua empresa em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsappPage,
});

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, "");

  if (digitos.length === 13 && digitos.startsWith("55")) {
    return `+${digitos.slice(0, 2)} ${digitos.slice(2, 4)} ${digitos.slice(4, 9)}-${digitos.slice(9)}`;
  }

  if (digitos.length === 12 && digitos.startsWith("55")) {
    return `+${digitos.slice(0, 2)} ${digitos.slice(2, 4)} ${digitos.slice(4, 8)}-${digitos.slice(8)}`;
  }

  return valor.startsWith("+") ? valor : `+${valor}`;
}

type MensagemMidia = {
  id: string;
  tipo: string;
  media_id?: string | null;
  media_mime?: string | null;
  media_nome?: string | null;
};

function formatarDuracao(segundos: number) {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const minutos = Math.floor(segundos / 60);
  const restante = Math.floor(segundos % 60);
  return `${minutos}:${String(restante).padStart(2, "0")}`;
}

const barrasAudio = [
  "h-2", "h-3", "h-5", "h-3", "h-6", "h-4", "h-2.5", "h-5", "h-7", "h-3.5",
  "h-5", "h-2.5", "h-4", "h-6", "h-3", "h-5", "h-2", "h-5", "h-4", "h-7",
  "h-3", "h-5", "h-2.5", "h-6", "h-4", "h-7", "h-3.5", "h-5", "h-3", "h-4",
  "h-6", "h-3.5",
];

function PlayerAudio({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const [atual, setAtual] = useState(0);
  const progresso = duracao > 0 ? Math.min(atual / duracao, 1) : 0;

  const alternar = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div className="flex min-w-64 max-w-80 items-center gap-3 py-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuracao(event.currentTarget.duration)}
        onDurationChange={(event) => setDuracao(event.currentTarget.duration)}
        onTimeUpdate={(event) => setAtual(event.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setAtual(0);
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        onClick={alternar}
        aria-label={tocando ? "Pausar áudio" : "Reproduzir áudio"}
      >
        {tocando ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </Button>
      <div className="min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          className="flex h-8 w-full items-center gap-0.5 rounded-none p-0 hover:bg-transparent"
          aria-label={`Áudio em ${formatarDuracao(atual)} de ${formatarDuracao(duracao)}`}
          onClick={(event) => {
            const audio = audioRef.current;
            if (!audio || duracao <= 0) return;
            const caixa = event.currentTarget.getBoundingClientRect();
            audio.currentTime = ((event.clientX - caixa.left) / caixa.width) * duracao;
          }}
        >
          {barrasAudio.map((altura, indice) => {
            const preenchida = indice / barrasAudio.length <= progresso;
            return (
              <span
                key={`${altura}-${indice}`}
                className={`w-1 flex-1 rounded-full transition-colors ${altura} ${
                  preenchida ? "bg-primary" : "bg-muted-foreground/35"
                }`}
              />
            );
          })}
        </Button>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{formatarDuracao(atual)}</span>
          <span>{formatarDuracao(duracao)}</span>
        </div>
      </div>
    </div>
  );
}

function arquivoParaBase64(arquivo: Blob) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

function canalParaPcm(canal: Float32Array, inicio: number, tamanho: number) {
  const pcm = new Int16Array(tamanho);
  for (let i = 0; i < tamanho; i += 1) {
    const amostra = Math.max(-1, Math.min(1, canal[inicio + i] ?? 0));
    pcm[i] = amostra < 0 ? amostra * 0x8000 : amostra * 0x7fff;
  }
  return pcm;
}

async function converterAudioParaMp3(gravacao: Blob) {
  const AudioContextClass = window.AudioContext;
  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(await gravacao.arrayBuffer());
    const { Mp3Encoder } = await import("@breezystack/lamejs");
    const canais = Math.min(audioBuffer.numberOfChannels, 2);
    const esquerdo = audioBuffer.getChannelData(0);
    const direito = canais === 2 ? audioBuffer.getChannelData(1) : undefined;
    const encoder = new Mp3Encoder(canais, audioBuffer.sampleRate, 96);
    const partes: BlobPart[] = [];

    for (let inicio = 0; inicio < audioBuffer.length; inicio += 1152) {
      const tamanho = Math.min(1152, audioBuffer.length - inicio);
      const pcmEsquerdo = canalParaPcm(esquerdo, inicio, tamanho);
      const pcmDireito = direito ? canalParaPcm(direito, inicio, tamanho) : undefined;
      const codificado = encoder.encodeBuffer(pcmEsquerdo, pcmDireito);
      if (codificado.length > 0) partes.push(new Uint8Array(codificado));
    }

    const final = encoder.flush();
    if (final.length > 0) partes.push(new Uint8Array(final));
    if (partes.length === 0) throw new Error("A gravação ficou vazia.");
    return new Blob(partes, { type: "audio/mpeg" });
  } finally {
    await audioContext.close();
  }
}

function MidiaMensagem({ mensagem }: { mensagem: MensagemMidia }) {
  const baixar = useServerFn(obterMidiaWhatsapp);
  const guardarCache = useServerFn(salvarCacheImagemWhatsapp);
  const automatico = mensagem.tipo === "image" || mensagem.tipo === "audio";
  const [abrir, setAbrir] = useState(automatico);
  const [expandida, setExpandida] = useState(false);

  const arquivo = useQuery({
    queryKey: ["whatsapp-midia", mensagem.id],
    queryFn: async () => {
      const r = await baixar({ data: { mensagemId: mensagem.id } });
      if (r.emCache || !(mensagem.tipo === "image" || r.mime.startsWith("image/"))) return r;
      // Primeira abertura: reduz bem a imagem e guarda no banco para as próximas vezes.
      try {
        const leve = await blobParaDataUrl(await reduzirImagem(r.dataUrl, 900, 0.55));
        guardarCache({ data: { mensagemId: mensagem.id, dataUrl: leve } }).catch(() => undefined);
        return { ...r, dataUrl: leve, mime: "image/jpeg" };
      } catch {
        return r;
      }
    },
    enabled: abrir,
    staleTime: 10 * 60_000,
  });

  if (!abrir) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAbrir(true)}>
        <Download /> Abrir arquivo
      </Button>
    );
  }
  if (arquivo.isLoading) {
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando arquivo...
      </span>
    );
  }
  if (arquivo.isError || !arquivo.data) {
    return <span className="text-xs text-destructive">Não foi possível abrir o arquivo.</span>;
  }
  if (mensagem.tipo === "image" || arquivo.data.mime.startsWith("image/")) {
    return (
      <>
        <button
          type="button"
          onClick={() => setExpandida(true)}
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg"
          aria-label="Ampliar imagem"
        >
          <img
            src={arquivo.data.dataUrl}
            alt={arquivo.data.nome}
            className="max-h-64 w-full rounded-lg object-cover transition hover:opacity-90"
          />
        </button>
        {expandida && (
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setExpandida(false)}
          >
            <div className="flex items-center justify-between gap-2 p-4" onClick={(e) => e.stopPropagation()}>
              <span className="truncate text-sm font-medium text-white">{arquivo.data.nome}</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  asChild
                >
                  <a href={arquivo.data.dataUrl} download={arquivo.data.nome}>
                    <Download /> Baixar
                  </a>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => setExpandida(false)}
                  aria-label="Fechar"
                >
                  <X />
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              <img
                src={arquivo.data.dataUrl}
                alt={arquivo.data.nome}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </>
    );
  }
  if (mensagem.tipo === "audio" || arquivo.data.mime.startsWith("audio/")) {
    return <PlayerAudio src={arquivo.data.dataUrl} />;
  }
  return (
    <a
      href={arquivo.data.dataUrl}
      download={arquivo.data.nome}
      className="flex items-center gap-2 text-xs underline"
    >
      <FileText className="h-4 w-4" /> {arquivo.data.nome}
    </a>
  );
}

function WhatsappPage() {
  const queryClient = useQueryClient();
  const carregarConversas = useServerFn(listarConversasWhatsapp);
  const carregarMensagens = useServerFn(listarMensagensWhatsapp);
  const enviar = useServerFn(enviarMensagemWhatsapp);
  const enviarMidia = useServerFn(enviarMidiaWhatsapp);
  const alterarAtendimento = useServerFn(setWhatsappConversationTakeover);
  const carregarTags = useServerFn(listarTagsWhatsapp);
  const criarTag = useServerFn(criarTagWhatsapp);
  const alternarTag = useServerFn(alternarTagConversa);
  const excluirConversa = useServerFn(excluirConversaWhatsapp);
  const [novaTagDialog, setNovaTagDialog] = useState<{ conversaId: string } | null>(null);
  const [novaTagNome, setNovaTagNome] = useState("");
  const [novaTagCor, setNovaTagCor] = useState("#00acdc");
  const [paraExcluir, setParaExcluir] = useState<{ id: string; nome: string } | null>(null);
  const [tagParaExcluir, setTagParaExcluir] = useState<{ id: string; nome: string } | null>(null);
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);
  const excluirTag = useServerFn(excluirTagWhatsapp);

  const tags = useQuery({ queryKey: ["whatsapp-tags"], queryFn: () => carregarTags() });
  const usoTagExcluir = useMemo(
    () => (tags.data?.vinculos ?? []).filter((v) => v.tag_id === tagParaExcluir?.id).length,
    [tags.data, tagParaExcluir],
  );
  const excluirTagMutation = useMutation({
    mutationFn: (tagId: string) => excluirTag({ data: { tagId } }),
    onSuccess: (_d, tagId) => {
      toast.success("Tag excluída.");
      setTagParaExcluir(null);
      if (tagFiltro === tagId) setTagFiltro(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tagsPorConversa = useMemo(() => {
    const info = new Map((tags.data?.tags ?? []).map((t) => [t.id, { nome: t.nome, cor: t.cor ?? "#00acdc" }]));
    const mapa = new Map<string, { id: string; nome: string; cor: string }[]>();
    for (const v of tags.data?.vinculos ?? []) {
      const tag = info.get(v.tag_id);
      if (!tag) continue;
      mapa.set(v.conversa_id, [...(mapa.get(v.conversa_id) ?? []), { id: v.tag_id, ...tag }]);
    }
    return mapa;
  }, [tags.data]);

  const criarTagMutation = useMutation({
    mutationFn: (entrada: { nome: string; cor: string; conversaId: string }) => criarTag({ data: entrada }),
    onSuccess: () => {
      setNovaTagDialog(null);
      setNovaTagNome("");
      setNovaTagCor("#00acdc");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const alternarTagMutation = useMutation({
    mutationFn: (entrada: { conversaId: string; tagId: string; ativo: boolean }) =>
      alternarTag({ data: entrada }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const excluirMutation = useMutation({
    mutationFn: (conversaId: string) => excluirConversa({ data: { conversaId } }),
    onSuccess: (_d, conversaId) => {
      toast.success("Conversa excluída.");
      setParaExcluir(null);
      if (selecionada === conversaId) setSelecionada(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-tags"] });
      queryClient.removeQueries({ queryKey: ["whatsapp-mensagens", conversaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const carregarNumeros = useServerFn(listarNumerosWhatsapp);

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [numeroFiltro, setNumeroFiltro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");

  const numeros = useQuery({
    queryKey: ["whatsapp-numeros"],
    queryFn: () => carregarNumeros(),
  });

  const [buscaAtiva, setBuscaAtiva] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  // Conversas: 30 por vez, carregando mais ao rolar (cursor por ultima_em).
  const conversas = useInfiniteQuery({
    queryKey: ["whatsapp-conversas", numeroFiltro, buscaAtiva, tagFiltro],
    queryFn: ({ pageParam }) =>
      carregarConversas({
        data: { antes: pageParam, numero: numeroFiltro, busca: buscaAtiva || null, tagId: tagFiltro },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximo,
    enabled: Boolean(numeroFiltro) || numeros.isFetched,
    refetchInterval: 15_000,
  });

  // Mensagens: últimas 40, buscando as mais antigas ao rolar para cima.
  const mensagens = useInfiniteQuery({
    queryKey: ["whatsapp-mensagens", selecionada],
    queryFn: ({ pageParam }) =>
      carregarMensagens({ data: { conversaId: selecionada as string, antes: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: (primeira) => primeira.anterior,
    enabled: Boolean(selecionada),
    refetchInterval: selecionada ? 15_000 : false,
  });
  const listaMensagens = useMemo(
    () => [...(mensagens.data?.pages ?? [])].reverse().flatMap((p) => p.itens),
    [mensagens.data],
  );
  const totalAntigas = useMemo(
    () => (mensagens.data?.pages ?? []).slice(1).reduce((n, p) => n + p.itens.length, 0),
    [mensagens.data],
  );

  useEffect(() => {
    const primeiroNumero = numeros.data?.[0]?.phone_number_id;
    if (!numeroFiltro && primeiroNumero) setNumeroFiltro(primeiroNumero);
  }, [numeroFiltro, numeros.data]);

  // Tempo real: o banco avisa assim que chega ou muda uma mensagem.
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const canal = supabase
      .channel("whatsapp-tempo-real")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_mensagens" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        () => queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [queryClient]);

  // Envio sem travar: cada mensagem aparece na hora e entra numa fila,
  // que envia uma por vez na ordem em que foram escritas.
  type Pendente = { id: string; conversaId: string; texto: string; criado_em: string; erro?: boolean };
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());
  const enviarMensagem = (textoBruto: string) => {
    const texto = textoBruto.trim();
    if (!texto || !selecionada) return;
    const item: Pendente = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversaId: selecionada,
      texto,
      criado_em: new Date().toISOString(),
    };
    setRascunho("");
    setPendentes((atual) => [...atual, item]);
    filaRef.current = filaRef.current.then(async () => {
      try {
        await enviar({ data: { conversaId: item.conversaId, texto: item.texto, enviadoEm: item.criado_em } });
        await queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", item.conversaId] });
        setPendentes((atual) => atual.filter((p) => p.id !== item.id));
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      } catch (erro) {
        setPendentes((atual) => atual.map((p) => (p.id === item.id ? { ...p, erro: true } : p)));
        toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar a mensagem.");
      }
    });
  };

  const exibidas = useMemo(() => {
    const doBanco = listaMensagens;
    const locais = pendentes
      .filter((p) => p.conversaId === selecionada)
      .map((p) => ({
        id: p.id,
        direcao: "saida",
        texto: p.texto,
        tipo: "text",
        status: p.erro ? "falhou" : "enviando",
        criado_em: p.criado_em,
        media_id: null as string | null,
        media_mime: null as string | null,
        media_nome: null as string | null,
      }));
    return [...doBanco, ...locais].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  }, [listaMensagens, pendentes, selecionada]);

  const inputImagemRef = useRef<HTMLInputElement>(null);
  const inputDocumentoRef = useRef<HTMLInputElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const [gravando, setGravando] = useState(false);

  const midiaMutation = useMutation({
    mutationFn: async (entrada: {
      arquivo: Blob;
      nome: string;
      tipo: "image" | "audio" | "document";
      mime: string;
    }) => {
      if (!selecionada) throw new Error("Selecione uma conversa para enviar o arquivo.");
      const dadosBase64 = await arquivoParaBase64(entrada.arquivo);
      return enviarMidia({
        data: {
          conversaId: selecionada,
          tipo: entrada.tipo,
          mimeType: entrada.mime,
          nomeArquivo: entrada.nome,
          dadosBase64,
          legenda: rascunho.trim() || null,
        },
      });
    },
    onSuccess: () => {
      setRascunho("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const formatos = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
      const formato = formatos.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
      const gravador = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);
      const partes: Blob[] = [];
      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) partes.push(evento.data);
      };
      gravador.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setGravando(false);
        const gravado = new Blob(partes, { type: gravador.mimeType || "audio/webm" });
        if (gravado.size === 0) return;
        try {
          const audioMp3 = await converterAudioParaMp3(gravado);
          midiaMutation.mutate({
            arquivo: audioMp3,
            nome: `audio-${Date.now()}.mp3`,
            tipo: "audio",
            mime: "audio/mpeg",
          });
        } catch {
          toast.error("Não foi possível preparar o áudio. Grave novamente e tente enviar.");
        }
      };
      gravadorRef.current = gravador;
      gravador.start();
      setGravando(true);
    } catch {
      toast.error("Não conseguimos acessar o microfone. Libere a permissão no navegador.");
    }
  };

  const pararGravacao = () => gravadorRef.current?.stop();

  const atendimentoMutation = useMutation({
    mutationFn: (manual: boolean) => {
      if (!selecionada) throw new Error("Selecione uma conversa para alterar o atendimento.");
      return alterarAtendimento({ data: { conversationId: selecionada, manual } });
    },
    onSuccess: (_data, manual) => {
      toast.success(manual ? "Atendimento assumido por você." : "Assistente de IA reativado.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });


  const lista = useMemo(
    () => (conversas.data?.pages ?? []).flatMap((p) => p.itens),
    [conversas.data],
  );
  const listaNumeros = numeros.data ?? [];
  const conversaSelecionada = lista.find((conversa) => conversa.id === selecionada);
  const numeroSelecionado = listaNumeros.find(
    (numero) => numero.phone_number_id === conversaSelecionada?.phone_number_id,
  );
  const possuiIa = Boolean(numeroSelecionado?.whatsapp_ai_agent_id);
  const rotuloNumero = (phoneNumberId: string) => {
    const n = listaNumeros.find((x) => x.phone_number_id === phoneNumberId);
    return n?.display_phone_number ?? n?.verified_name ?? "Número";
  };
  const filtradas = lista;

  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-3">
        {listaNumeros.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-border/60 pb-3">
            {listaNumeros.map((numero) => {
              const ativo = numeroFiltro === numero.phone_number_id;
              const rotulo = numero.display_phone_number ?? numero.verified_name ?? "Número";

              return (
                <Button
                  key={numero.id}
                  type="button"
                  size="sm"
                  variant={ativo ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => {
                    setNumeroFiltro(numero.phone_number_id);
                    if (conversaSelecionada?.phone_number_id !== numero.phone_number_id) {
                      setSelecionada(null);
                    }
                  }}
                >
                  <Smartphone />
                  {rotulo}
                </Button>
              );
            })}
          </div>
        ) : null}
        <div className="grid flex-1 gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex h-[calc(100dvh-10rem)] min-h-[560px] flex-col gap-3 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, número ou tag"
                  className="pl-9"
                />
              </div>
              {(tags.data?.tags ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(tags.data?.tags ?? []).map((t) => {
                    const ativa = tagFiltro === t.id;
                    const cor = t.cor ?? "#00acdc";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTagFiltro(ativa ? null : t.id)}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors"
                        style={{
                          borderColor: cor,
                          backgroundColor: ativa ? cor : "transparent",
                          color: ativa ? "#fff" : cor,
                        }}
                      >
                        {t.nome}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="min-h-0 flex-1">
                {conversas.isLoading ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Carregando conversas...
                  </p>
                ) : filtradas.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma conversa por aqui ainda.
                  </p>
                ) : (
                  <Virtuoso
                    className="h-full"
                    data={filtradas}
                    computeItemKey={(_i, c) => c.id}
                    endReached={() => {
                      if (conversas.hasNextPage && !conversas.isFetchingNextPage) conversas.fetchNextPage();
                    }}
                    components={{
                      Footer: () =>
                        conversas.isFetchingNextPage ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">Carregando...</p>
                        ) : null,
                    }}
                    itemContent={(_i, c) => (
                      <div className="pb-1">
                      <ContextMenu>
                      <ContextMenuTrigger asChild>
                      <button
                        onClick={() => setSelecionada(c.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                          selecionada === c.id
                            ? "bg-sidebar-accent text-primary"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {c.contato_nome ?? c.contato_wa_id}
                          </p>
                          {c.nao_lidas > 0 ? (
                            <Badge className="h-5 min-w-5 justify-center px-1 text-[10px]">
                              {c.nao_lidas}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.ultima_mensagem ?? ""}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground/80">
                          via {rotuloNumero(c.phone_number_id)}
                        </p>
                        {(tagsPorConversa.get(c.id) ?? []).length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(tagsPorConversa.get(c.id) ?? []).map((t) => (
                              <Badge
                                key={t.id}
                                variant="outline"
                                className="h-4 px-1.5 text-[9px] font-normal"
                                style={{ borderColor: t.cor, color: t.cor, backgroundColor: `${t.cor}1a` }}
                              >
                                {t.nome}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        <ContextMenuLabel className="truncate text-xs">
                          {c.contato_nome ?? formatarTelefone(c.contato_wa_id)}
                        </ContextMenuLabel>
                        <ContextMenuSeparator />
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>Adicionar tag</ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-56">
                            <ContextMenuItem
                              onSelect={() => {
                                setNovaTagNome("");
                                setNovaTagCor("#00acdc");
                                setNovaTagDialog({ conversaId: c.id });
                              }}
                            >
                              Nova tag
                            </ContextMenuItem>
                            {(tags.data?.tags ?? []).length > 0 ? <ContextMenuSeparator /> : null}
                            {(tags.data?.tags ?? []).map((t) => {
                              const ativa = (tagsPorConversa.get(c.id) ?? []).some((x) => x.id === t.id);
                              return (
                                <ContextMenuCheckboxItem
                                  key={t.id}
                                  checked={ativa}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={(v) =>
                                    alternarTagMutation.mutate({ conversaId: c.id, tagId: t.id, ativo: Boolean(v) })
                                  }
                                >
                                  <span
                                    className="mr-1 inline-block size-2.5 rounded-full"
                                    style={{ backgroundColor: t.cor ?? "#00acdc" }}
                                  />
                                  <span className="flex-1 truncate">{t.nome}</span>
                                  <button
                                    type="button"
                                    aria-label={`Excluir tag ${t.nome}`}
                                    className="ml-2 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setTagParaExcluir({ id: t.id, nome: t.nome });
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </ContextMenuCheckboxItem>
                              );
                            })}
                            {tags.data?.aviso ? (
                              <p className="px-2 py-1 text-[11px] text-destructive">{tags.data.aviso}</p>
                            ) : null}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() =>
                            setParaExcluir({ id: c.id, nome: c.contato_nome ?? formatarTelefone(c.contato_wa_id) })
                          }
                        >
                          Excluir conversa
                        </ContextMenuItem>
                      </ContextMenuContent>
                      </ContextMenu>
                      </div>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex h-[calc(100dvh-10rem)] min-h-[560px] flex-col p-0">
              {selecionada ? (
                <>
                  <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{conversaSelecionada?.contato_nome ?? conversaSelecionada?.contato_wa_id}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {conversaSelecionada ? formatarTelefone(conversaSelecionada.contato_wa_id) : ""}
                      </p>
                    </div>
                    {possuiIa ? (
                      <Button
                        variant={conversaSelecionada?.manual_takeover ? "secondary" : "outline"}
                        size="sm"
                        disabled={atendimentoMutation.isPending}
                        onClick={() => atendimentoMutation.mutate(!conversaSelecionada?.manual_takeover)}
                      >
                        {atendimentoMutation.isPending ? <Loader2 className="animate-spin" /> : conversaSelecionada?.manual_takeover ? <Bot /> : <UserRound />}
                        {conversaSelecionada?.manual_takeover ? "Reativar IA" : "Assumir conversa"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1">
                    <Virtuoso
                      key={selecionada}
                      className="h-full"
                      data={exibidas}
                      firstItemIndex={100_000 - totalAntigas}
                      initialTopMostItemIndex={Math.max(exibidas.length - 1, 0)}
                      followOutput="smooth"
                      alignToBottom
                      computeItemKey={(_i, m) => m.id}
                      startReached={() => {
                        if (mensagens.hasNextPage && !mensagens.isFetchingNextPage) mensagens.fetchNextPage();
                      }}
                      components={{
                        Header: () =>
                          mensagens.isFetchingNextPage ? (
                            <p className="py-2 text-center text-xs text-muted-foreground">Carregando mensagens antigas...</p>
                          ) : <div className="h-4" />,
                        Footer: () => <div className="h-4" />,
                      }}
                      itemContent={(_i, m) => (
                        <div className="px-4 py-1.5">
                        <Message from={m.direcao === "saida" ? "user" : "assistant"}>
                          <MessageContent className={m.direcao === "entrada" ? "rounded-lg bg-muted px-4 py-3" : ""}>
                            {m.media_id ? (
                              <div className="mb-1">
                                <MidiaMensagem mensagem={m} />
                              </div>
                            ) : null}
                            {m.tipo === "audio" && !m.media_id ? (
                              <span className="flex min-w-56 items-center gap-2 py-1 text-xs text-muted-foreground">
                                <Mic className="h-4 w-4 text-primary" />
                                Áudio recebido sem arquivo disponível
                              </span>
                            ) : !(m.tipo === "audio" && /^\s*\[?audio\]?\s*$/i.test(m.texto ?? "")) ? (
                              <span className="whitespace-pre-wrap break-words">{m.texto}</span>
                            ) : null}
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {hora(m.criado_em)}
                              {m.status === "enviando" ? " · enviando..." : m.status === "falhou" ? " · não enviada" : ""}
                            </span>
                          </MessageContent>
                        </Message>
                        </div>
                      )}
                    />
                  </div>
                  <div className="border-t border-border/60 p-3">
                    <PromptInput
                      onSubmit={({ text }) => {
                        const value = (text || rascunho).trim();
                        if (value) enviarMensagem(value);
                      }}
                    >
                      <PromptInputBody>
                        <Textarea
                          value={rascunho}
                          onChange={(event) => setRascunho(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              enviarMensagem(rascunho);
                            }
                          }}
                          placeholder="Escreva uma mensagem"
                          className="min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                        />
                      </PromptInputBody>
                      <PromptInputFooter>
                        <div className="flex items-center gap-1">
                          <input
                            ref={inputImagemRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const arquivo = event.target.files?.[0];
                              event.target.value = "";
                              if (arquivo)
                                reduzirImagem(arquivo, 1280, 0.65)
                                  .then((leve) =>
                                    midiaMutation.mutate({
                                      arquivo: leve,
                                      nome: arquivo.name.replace(/\.[^.]+$/, "") + ".jpg",
                                      tipo: "image",
                                      mime: "image/jpeg",
                                    }),
                                  )
                                  .catch(() => toast.error("Não foi possível preparar a imagem."));
                            }}
                          />
                          <input
                            ref={inputDocumentoRef}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const arquivo = event.target.files?.[0];
                              event.target.value = "";
                              if (arquivo)
                                midiaMutation.mutate({
                                  arquivo,
                                  nome: arquivo.name,
                                  tipo: "document",
                                  mime: arquivo.type || "application/octet-stream",
                                });
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Enviar foto"
                            disabled={midiaMutation.isPending}
                            onClick={() => inputImagemRef.current?.click()}
                          >
                            <ImageIcon />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Enviar documento"
                            disabled={midiaMutation.isPending}
                            onClick={() => inputDocumentoRef.current?.click()}
                          >
                            <Paperclip />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant={gravando ? "destructive" : "ghost"}
                            title={gravando ? "Parar e enviar áudio" : "Gravar áudio"}
                            disabled={midiaMutation.isPending}
                            onClick={() => (gravando ? pararGravacao() : iniciarGravacao())}
                          >
                            {midiaMutation.isPending ? <Loader2 className="animate-spin" /> : gravando ? <Square /> : <Mic />}
                          </Button>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {gravando ? "Gravando... toque no quadrado para enviar" : "Enter para enviar · Shift + Enter para quebrar linha"}
                          </span>
                        </div>
                        <PromptInputSubmit disabled={!rascunho.trim()} status="ready" />
                      </PromptInputFooter>
                    </PromptInput>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {listaNumeros.length === 0
                        ? "Nenhum número conectado"
                        : "Nenhuma conversa selecionada"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {listaNumeros.length === 0
                        ? "Conecte um número de WhatsApp para começar a receber mensagens."
                        : "Escolha uma conversa na lista ao lado para ver as mensagens."}
                    </p>
                  </div>
                  {listaNumeros.length === 0 ? (
                    <Button asChild variant="outline">
                      <Link to="/whatsapp-numeros">Conectar um número</Link>
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <AlertDialog open={Boolean(paraExcluir)} onOpenChange={(v) => !v && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa com {paraExcluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conversa, todas as mensagens, arquivos e tags dela
              serão apagados definitivamente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluirMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (paraExcluir) excluirMutation.mutate(paraExcluir.id);
              }}
            >
              {excluirMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(tagParaExcluir)} onOpenChange={(v) => !v && setTagParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a tag “{tagParaExcluir?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {usoTagExcluir > 0
                ? `${usoTagExcluir} ${usoTagExcluir === 1 ? "contato está usando" : "contatos estão usando"} esta tag. Ela será removida de todos. `
                : "Nenhum contato está usando esta tag. "}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirTagMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluirTagMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (tagParaExcluir) excluirTagMutation.mutate(tagParaExcluir.id);
              }}
            >
              {excluirTagMutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Excluir tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(novaTagDialog)} onOpenChange={(v) => !v && setNovaTagDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova tag</DialogTitle>
            <DialogDescription>Defina o nome e a cor. A tag já sai aplicada na conversa.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (novaTagDialog && novaTagNome.trim())
                criarTagMutation.mutate({
                  nome: novaTagNome.trim(),
                  cor: novaTagCor,
                  conversaId: novaTagDialog.conversaId,
                });
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                value={novaTagNome}
                onChange={(e) => setNovaTagNome(e.target.value)}
                placeholder="Ex.: Cliente VIP"
                maxLength={40}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cor</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={novaTagCor}
                  onChange={(e) => setNovaTagCor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  aria-label="Escolher cor"
                />
                <div className="flex flex-wrap gap-1.5">
                  {["#00acdc", "#2abb65", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNovaTagCor(c)}
                      className="size-6 rounded-full border border-border/60 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: novaTagCor === c ? `2px solid ${c}` : undefined,
                        outlineOffset: 2,
                      }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>
              <Badge
                variant="outline"
                className="mt-1"
                style={{ borderColor: novaTagCor, color: novaTagCor, backgroundColor: `${novaTagCor}1a` }}
              >
                {novaTagNome.trim() || "Prévia da tag"}
              </Badge>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNovaTagDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!novaTagNome.trim() || criarTagMutation.isPending}>
                {criarTagMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Criar tag
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
