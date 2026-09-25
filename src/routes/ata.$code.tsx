import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Share2,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMeetingSummary, type MeetingPendencia } from "@/lib/livekit.functions";

export const Route = createFileRoute("/ata/$code")({
  validateSearch: (search: Record<string, unknown>): { p?: string } =>
    typeof search.p === "string" && search.p.trim() ? { p: search.p } : {},
  head: () => ({
    meta: [
      { title: "Resumo da reunião — Omniasyn" },
      { name: "description", content: "Ata, resumo e pendências da reunião Omniasyn." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Resumo da reunião — Omniasyn" },
      { property: "og:description", content: "Ata, resumo e pendências da reunião Omniasyn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtaPage,
});

function AtaPage() {
  const { code } = Route.useParams();
  const { p: pessoa } = Route.useSearch();
  const fetchSummary = useServerFn(getMeetingSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["meeting-summary", code],
    queryFn: () => fetchSummary({ data: { code } }),
    // A ata chega quando a sala fecha; enquanto isso, consulta de novo.
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 6000 : false),
  });

  const porPessoa = useMemo(() => {
    const map = new Map<string, MeetingPendencia[]>();
    if (data?.status === "ready") {
      for (const p of data.summary.pendencias) {
        map.set(p.responsavel, [...(map.get(p.responsavel) ?? []), p]);
      }
    }
    return [...map.entries()].sort(([a], [b]) =>
      pessoa ? (a === pessoa ? -1 : b === pessoa ? 1 : 0) : a.localeCompare(b),
    );
  }, [data, pessoa]);

  const compartilhar = async (nome: string) => {
    const url = `${window.location.origin}/ata/${code}?p=${encodeURIComponent(nome)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Suas pendências da reunião", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(`Link de ${nome} copiado`);
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">{children}</div>
    </div>
  );

  if (isLoading || !data) {
    return shell(
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>,
    );
  }

  if (data.status === "not_found") {
    return shell(
      <Aviso titulo="Reunião não encontrada" texto="Confira o link recebido." />,
    );
  }

  const header = (
    <div className="space-y-1">
      <Badge variant="outline" className="border-primary/40 text-primary">
        Reunião encerrada
      </Badge>
      <h1 className="text-2xl font-semibold">{data.name}</h1>
      <p className="font-mono text-xs text-muted-foreground">{code}</p>
    </div>
  );

  if (data.status === "no_transcription") {
    return shell(
      <>
        {header}
        <Aviso
          titulo="Esta reunião não teve transcrição"
          texto="A transcrição automática não estava ligada, então não há ata nem resumo."
        />
      </>,
    );
  }

  if (data.status === "pending") {
    return shell(
      <>
        {header}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="flex items-center gap-4 py-8">
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
            <div>
              <p className="font-medium">Preparando a ata e o resumo…</p>
              <p className="text-sm text-muted-foreground">
                A transcrição fica pronta quando a reunião termina para todos. Deixe esta
                página aberta — ela atualiza sozinha.
              </p>
            </div>
          </CardContent>
        </Card>
      </>,
    );
  }

  return shell(
    <>
      {header}

      {data.status === "no_key" && (
        <Aviso
          titulo="Resumo indisponível"
          texto="O organizador ainda não cadastrou a chave do Gemini em Configurações → API e chaves. A transcrição completa está abaixo."
        />
      )}
      {data.status === "error" && (
        <Aviso titulo="Não foi possível gerar o resumo" texto={data.message} />
      )}

      {data.status === "ready" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Resumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {data.summary.resumo || "Sem resumo."}
              </p>
              {data.summary.pontos_importantes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Anotações importantes</p>
                  <ul className="space-y-1.5">
                    {data.summary.pontos_importantes.map((pt, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-primary" /> Pendências por pessoa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {porPessoa.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma pendência ficou combinada.</p>
              )}
              {porPessoa.map(([nome, itens]) => (
                <div
                  key={nome}
                  className={`rounded-xl border p-4 ${
                    pessoa === nome ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-primary" /> {nome}
                      {pessoa === nome && <Badge className="ml-1">Você</Badge>}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => compartilhar(nome)}
                    >
                      <Share2 className="h-4 w-4" /> Compartilhar
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {itens.map((it, i) => (
                      <li key={i} className="text-sm">
                        • {it.tarefa}
                        {it.prazo && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (prazo: {it.prazo})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Transcrição completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 font-sans text-sm leading-relaxed">
            {data.transcript}
          </pre>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button asChild variant="ghost">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </>,
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Card className="border-border">
      <CardContent className="py-6">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </CardContent>
    </Card>
  );
}
