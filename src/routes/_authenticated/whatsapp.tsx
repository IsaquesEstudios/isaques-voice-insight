import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Search, Send } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

type Conversa = {
  id: string;
  nome: string;
  numero: string;
  ultimaMensagem: string;
  horario: string;
};

type Mensagem = {
  id: string;
  autor: "cliente" | "empresa";
  texto: string;
  horario: string;
};

function WhatsappPage() {
  const [conversas] = useState<Conversa[]>([]);
  const [mensagens] = useState<Mensagem[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");

  const filtradas = conversas.filter((c) =>
    `${c.nome} ${c.numero}`.toLowerCase().includes(busca.toLowerCase())
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
              <ScrollArea className="flex-1">
                {filtradas.length === 0 ? (
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
                        <p className="truncate text-sm font-medium text-foreground">
                          {c.nome}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.ultimaMensagem}
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
                      {mensagens.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                            m.autor === "empresa"
                              ? "self-end bg-primary/15 text-foreground"
                              : "self-start bg-muted text-foreground"
                          }`}
                        >
                          {m.texto}
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {m.horario}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex items-center gap-2 border-t border-border/60 p-3">
                    <Input
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      placeholder="Escreva uma mensagem"
                    />
                    <Button size="icon" aria-label="Enviar mensagem">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      Nenhuma conversa selecionada
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Conecte um número de WhatsApp para começar a receber mensagens.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link to="/whatsapp-numeros">Conectar um número</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
