import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Download, FileText, ImageIcon, Loader2, MessageCircle, Mic, Paperclip, Search, Smartphone, Square, UserRound } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
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

function arquivoParaBase64(arquivo: Blob) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

function MidiaMensagem({ mensagem }: { mensagem: MensagemMidia }) {
  const baixar = useServerFn(obterMidiaWhatsapp);
  const automatico = mensagem.tipo === "image" || mensagem.tipo === "audio";
  const [abrir, setAbrir] = useState(automatico);

  const arquivo = useQuery({
    queryKey: ["whatsapp-midia", mensagem.id],
    queryFn: () => baixar({ data: { mensagemId: mensagem.id } }),
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
      <img
        src={arquivo.data.dataUrl}
        alt={arquivo.data.nome}
        className="max-h-64 w-full rounded-lg object-cover"
      />
    );
  }
  if (mensagem.tipo === "audio" || arquivo.data.mime.startsWith("audio/")) {
    return <audio controls src={arquivo.data.dataUrl} className="w-56" />;
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

  const carregarNumeros = useServerFn(listarNumerosWhatsapp);

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [numeroFiltro, setNumeroFiltro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");

  const numeros = useQuery({
    queryKey: ["whatsapp-numeros"],
    queryFn: () => carregarNumeros(),
  });

  const conversas = useQuery({
    queryKey: ["whatsapp-conversas"],
    queryFn: () => carregarConversas(),
    refetchInterval: 3_000,
  });

  const mensagens = useQuery({
    queryKey: ["whatsapp-mensagens", selecionada],
    queryFn: () => {
      if (!selecionada) return Promise.resolve([]);
      return carregarMensagens({ data: { conversaId: selecionada } });
    },
    enabled: Boolean(selecionada),
    refetchInterval: selecionada ? 3_000 : false,
  });

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

  const enviarMutation = useMutation({
    mutationFn: (texto: string) => {
      if (!selecionada) throw new Error("Selecione uma conversa para enviar a mensagem.");
      return enviar({ data: { conversaId: selecionada, texto } });
    },
    onSuccess: () => {
      setRascunho("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

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
      const formatos = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      const formato = formatos.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
      const gravador = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);
      const partes: Blob[] = [];
      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) partes.push(evento.data);
      };
      gravador.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setGravando(false);
        const mime = (gravador.mimeType || "audio/ogg").split(";")[0] ?? "audio/ogg";
        const extensao = mime.includes("mp4") ? "m4a" : mime.includes("webm") ? "webm" : "ogg";
        const audio = new Blob(partes, { type: mime });
        if (audio.size === 0) return;
        midiaMutation.mutate({
          arquivo: audio,
          nome: `audio-${Date.now()}.${extensao}`,
          tipo: "audio",
          mime,
        });
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


  const lista = conversas.data ?? [];
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
  const filtradas = useMemo(
    () =>
      lista
        .filter((c) => !numeroFiltro || c.phone_number_id === numeroFiltro)
        .filter((c) =>
          `${c.contato_nome ?? ""} ${c.contato_wa_id}`
            .toLowerCase()
            .includes(busca.toLowerCase())
        ),
    [lista, busca, numeroFiltro]
  );

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
                  placeholder="Buscar conversa"
                  className="pl-9"
                />
              </div>
              <ScrollArea className="flex-1">
                {conversas.isLoading ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Carregando conversas...
                  </p>
                ) : filtradas.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma conversa por aqui ainda.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filtradas.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelecionada(c.id)}
                        className={`rounded-lg px-3 py-2 text-left transition-colors ${
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
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
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
                  <Conversation>
                    <ConversationContent className="gap-3 p-4">
                      {(mensagens.data ?? []).map((m) => (
                        <Message key={m.id} from={m.direcao === "saida" ? "user" : "assistant"}>
                          <MessageContent className={m.direcao === "entrada" ? "rounded-lg bg-muted px-4 py-3" : ""}>
                            {m.media_id ? (
                              <div className="mb-1">
                                <MidiaMensagem mensagem={m} />
                              </div>
                            ) : null}
                            <span className="whitespace-pre-wrap break-words">{m.texto}</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {hora(m.criado_em)}
                            </span>
                          </MessageContent>
                        </Message>
                      ))}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>
                  <div className="border-t border-border/60 p-3">
                    <PromptInput
                      onSubmit={({ text }) => {
                        const value = (text || rascunho).trim();
                        if (value) enviarMutation.mutate(value);
                      }}
                    >
                      <PromptInputBody>
                        <Textarea
                          value={rascunho}
                          onChange={(event) => setRascunho(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              if (rascunho.trim() && !enviarMutation.isPending) enviarMutation.mutate(rascunho);
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
                                midiaMutation.mutate({
                                  arquivo,
                                  nome: arquivo.name,
                                  tipo: "image",
                                  mime: arquivo.type || "image/jpeg",
                                });
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
                        <PromptInputSubmit disabled={enviarMutation.isPending || !rascunho.trim()} status={enviarMutation.isPending ? "submitted" : "ready"} />
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
    </DashboardShell>
  );
}
