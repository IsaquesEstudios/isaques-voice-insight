import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import {
  enviarMensagemWhatsapp,
  listarConversasWhatsapp,
  listarMensagensWhatsapp,
  listarNumerosWhatsapp,
} from "@/lib/whatsapp.functions";


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

function WhatsappPage() {
  const queryClient = useQueryClient();
  const carregarConversas = useServerFn(listarConversasWhatsapp);
  const carregarMensagens = useServerFn(listarMensagensWhatsapp);
  const enviar = useServerFn(enviarMensagemWhatsapp);

  const carregarNumeros = useServerFn(listarNumerosWhatsapp);

  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [numeroFiltro, setNumeroFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");

  const numeros = useQuery({
    queryKey: ["whatsapp-numeros"],
    queryFn: () => carregarNumeros(),
  });

  const conversas = useQuery({
    queryKey: ["whatsapp-conversas"],
    queryFn: () => carregarConversas(),
    refetchInterval: 5000,
  });

  const mensagens = useQuery({
    queryKey: ["whatsapp-mensagens", selecionada],
    queryFn: () => carregarMensagens({ data: { conversaId: selecionada! } }),
    enabled: Boolean(selecionada),
    refetchInterval: 5000,
  });

  const enviarMutation = useMutation({
    mutationFn: (texto: string) =>
      enviar({ data: { conversaId: selecionada!, texto } }),
    onSuccess: () => {
      setRascunho("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens", selecionada] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const lista = conversas.data ?? [];
  const listaNumeros = numeros.data ?? [];
  const rotuloNumero = (phoneNumberId: string) => {
    const n = listaNumeros.find((x) => x.phone_number_id === phoneNumberId);
    return n?.display_phone_number ?? n?.verified_name ?? "Número";
  };
  const filtradas = useMemo(
    () =>
      lista
        .filter((c) => numeroFiltro === "todos" || c.phone_number_id === numeroFiltro)
        .filter((c) =>
          `${c.contato_nome ?? ""} ${c.contato_wa_id}`
            .toLowerCase()
            .includes(busca.toLowerCase())
        ),
    [lista, busca, numeroFiltro]
  );

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as conversas dos seus números de WhatsApp em um só lugar.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex h-[540px] flex-col gap-3 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conversa"
                  className="pl-9"
                />
              </div>
              {listaNumeros.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setNumeroFiltro("todos")}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      numeroFiltro === "todos"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    Todos
                  </button>
                  {listaNumeros.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setNumeroFiltro(n.phone_number_id)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        numeroFiltro === n.phone_number_id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {n.display_phone_number ?? n.verified_name ?? "Número"}
                    </button>
                  ))}
                </div>
              ) : null}
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
            <CardContent className="flex h-[540px] flex-col p-0">
              {selecionada ? (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col gap-3">
                      {(mensagens.data ?? []).map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                            m.direcao === "saida"
                              ? "self-end bg-primary/15 text-foreground"
                              : "self-start bg-muted text-foreground"
                          }`}
                        >
                          {m.texto}
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {hora(m.criado_em)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <form
                    className="flex items-center gap-2 border-t border-border/60 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (rascunho.trim()) enviarMutation.mutate(rascunho);
                    }}
                  >
                    <Input
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      placeholder="Escreva uma mensagem"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Enviar mensagem"
                      disabled={enviarMutation.isPending || !rascunho.trim()}
                    >
                      {enviarMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
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
