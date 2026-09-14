import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Hash, Plus, ShieldCheck, Trash2 } from "lucide-react";
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

type NumeroWhatsapp = {
  id: string;
  numero: string;
  nome: string;
  status: "conectado" | "pendente";
};

function WhatsappNumerosPage() {
  const [numeros] = useState<NumeroWhatsapp[]>([]);

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
          <Button
            onClick={() =>
              toast.info(
                "A conexão com o WhatsApp está sendo liberada. Avisaremos assim que estiver disponível."
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
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

        {numeros.length === 0 ? (
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
            {numeros.map((n) => (
              <Card key={n.id} className="border-border/60 bg-card/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{n.numero}</CardTitle>
                    <CardDescription>{n.nome}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={n.status === "conectado" ? "default" : "secondary"}>
                      {n.status === "conectado" ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : null}
                      {n.status === "conectado" ? "Conectado" : "Pendente"}
                    </Badge>
                    <Button variant="ghost" size="icon" aria-label="Remover número">
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
