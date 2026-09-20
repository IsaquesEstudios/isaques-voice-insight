import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Hash, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  conectarWhatsapp,
  listarNumerosWhatsapp,
  obterConfigWhatsapp,
  removerNumeroWhatsapp,
  sincronizarNumerosWhatsapp,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp-numeros")({
  head: () => ({
    meta: [
      { title: "Números de WhatsApp — Omniasyn" },
      {
        name: "description",
        content:
          "Conecte a conta WhatsApp Business da sua empresa e gerencie os números vinculados ao painel.",
      },
      { property: "og:title", content: "Números de WhatsApp — Omniasyn" },
      {
        property: "og:description",
        content: "Conecte e gerencie os números de WhatsApp da sua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsappNumerosPage,
});

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        cb: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function carregarSdkMeta(appId: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }
    const existente = document.getElementById("facebook-jssdk");
    if (!existente) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => reject(new Error("Falha ao carregar o Meta."));
      document.body.appendChild(script);
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: true, xfbml: false, version: "v26.0" });
      resolve();
    };
    setTimeout(() => (window.FB ? resolve() : reject(new Error("Tempo esgotado."))), 15000);
  });
}

function WhatsappNumerosPage() {
  const queryClient = useQueryClient();
  const carregarConfig = useServerFn(obterConfigWhatsapp);
  const carregarNumeros = useServerFn(listarNumerosWhatsapp);
  const conectar = useServerFn(conectarWhatsapp);
  const remover = useServerFn(removerNumeroWhatsapp);
  const sincronizar = useServerFn(sincronizarNumerosWhatsapp);
  const [abrindo, setAbrindo] = useState(false);
  const sessaoRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const [diagnostico, setDiagnostico] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: () => carregarConfig(),
    staleTime: Infinity,
  });

  const numeros = useQuery({
    queryKey: ["whatsapp-numeros"],
    queryFn: () => carregarNumeros(),
    staleTime: 30_000,
  });

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com") return;
      try {
        const dados = JSON.parse(event.data as string) as {
          type?: string;
          event?: string;
          data?: {
            waba_id?: string;
            phone_number_id?: string;
            current_step?: string;
          };
        };
        if (dados.type !== "WA_EMBEDDED_SIGNUP") return;

        if (
          (dados.event === "FINISH" || dados.event === "FINISH_ONLY_WABA") &&
          dados.data
        ) {
          sessaoRef.current = {
            wabaId: dados.data.waba_id,
            phoneNumberId: dados.data.phone_number_id,
          };
          setDiagnostico(null);
          return;
        }

        if (dados.event === "CANCEL") {
          const etapa = dados.data?.current_step;
          setDiagnostico(
            etapa
              ? `A Meta interrompeu a conexão na etapa ${etapa}.`
              : "A Meta interrompeu a conexão antes de liberar os ativos."
          );
        }
      } catch {
        /* mensagens não relacionadas */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const conectarMutation = useMutation({
    mutationFn: (input: {
      code: string;
      wabaId?: string | null;
      phoneNumberId?: string | null;
    }) => conectar({ data: input }),
    onSuccess: () => {
      toast.success("WhatsApp conectado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success("Número removido.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  async function iniciarConexao() {
    const dados = config.data;
    if (!dados?.appId || !dados.configId || !dados.configurado) {
      toast.error(
        "A integração com a Meta ainda não está configurada. Verifique as credenciais do aplicativo."
      );
      return;
    }
    setAbrindo(true);
    setDiagnostico(null);
    try {
      await carregarSdkMeta(dados.appId);
      sessaoRef.current = {};
      window.FB?.login(
        (response) => {
          const code = response?.authResponse?.code;
          if (!code) {
            toast.error(
              "A Meta não autorizou a conexão. Confira o aviso exibido na janela de cadastro."
            );
            return;
          }
          conectarMutation.mutate({
            code,
            wabaId: sessaoRef.current.wabaId ?? null,
            phoneNumberId: sessaoRef.current.phoneNumberId ?? null,
          });
        },
        {
          config_id: dados.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {},
        }
      );
    } catch {
      toast.error("Não conseguimos abrir a janela do Meta. Tente novamente.");
    } finally {
      setAbrindo(false);
    }
  }

  const lista = numeros.data ?? [];
  const ocupado = abrindo || conectarMutation.isPending;

  return (
    <DashboardShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Números de WhatsApp
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecte a conta WhatsApp Business da sua empresa e escolha quais números
              vão atender pelo painel.
            </p>
          </div>
          <Button onClick={iniciarConexao} disabled={ocupado}>
            {ocupado ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Conectar WhatsApp
          </Button>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            A conexão é feita com a sua própria conta do Meta: você escolhe a conta
            comercial, o número e o meio de pagamento continua com você.
          </AlertDescription>
        </Alert>

        {diagnostico ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{diagnostico}</AlertDescription>
          </Alert>
        ) : null}

        {numeros.isLoading ? (
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando números...
            </CardContent>
          </Card>
        ) : lista.length === 0 ? (
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Hash className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  Nenhum número conectado ainda
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clique em “Conectar WhatsApp” para vincular o primeiro número da sua
                  empresa.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {lista.map((n) => (
              <Card key={n.id} className="border-border/60 bg-card/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {n.display_phone_number ?? n.phone_number_id}
                    </CardTitle>
                    <CardDescription>
                      {n.verified_name ?? "Conta comercial"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={n.status === "conectado" ? "default" : "secondary"}>
                      {n.status === "conectado" ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : null}
                      {n.status === "conectado" ? "Conectado" : "Pendente"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover número"
                      disabled={removerMutation.isPending}
                      onClick={() => removerMutation.mutate(n.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
