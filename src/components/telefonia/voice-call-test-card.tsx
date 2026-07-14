import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOutboundTestCall,
  listVapiAssistants,
  listVapiPhoneNumbers,
} from "@/lib/vapi.functions";

interface Props {
  /** Prefill customer number (verified Twilio caller ID). */
  defaultCustomerNumber?: string;
  /** Fix the assistant — when provided, hides the assistant selector. */
  assistantId?: string;
}

export function VoiceCallTestCard({ defaultCustomerNumber, assistantId }: Props) {
  const listAssistantsFn = useServerFn(listVapiAssistants);
  const listVapiPhoneNumbersFn = useServerFn(listVapiPhoneNumbers);
  const outboundCallFn = useServerFn(createOutboundTestCall);

  const assistantsQuery = useQuery({
    queryKey: ["vapi-assistants"],
    queryFn: () => listAssistantsFn(),
    enabled: !assistantId,
  });
  const phonesQuery = useQuery({
    queryKey: ["vapi-phone-numbers"],
    queryFn: () => listVapiPhoneNumbersFn(),
  });

  const phones = useMemo(
    () => (phonesQuery.data ?? []).filter((p) => p.number),
    [phonesQuery.data],
  );

  const [selectedAssistant, setSelectedAssistant] = useState<string>(assistantId ?? "");
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>("");
  const [customerNumber, setCustomerNumber] = useState<string>(
    defaultCustomerNumber ?? "",
  );

  const callMutation = useMutation({
    mutationFn: (input: {
      assistantId: string;
      phoneNumberId: string;
      customerNumber: string;
    }) => outboundCallFn({ data: input }),
    onSuccess: () => {
      toast.info(
        "Chamada iniciada! Atenda o seu celular. Como você está usando uma conta de teste da Twilio, você ouvirá uma gravação em inglês. Pressione QUALQUER TECLA do teclado do seu celular para liberar a linha e falar com a IA.",
        { duration: Infinity, closeButton: true },
      );
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err ?? "");
      const lower = raw.toLowerCase();
      let msg = raw || "Falha ao iniciar a chamada.";
      if (
        lower.includes("unauthorized") ||
        lower.includes("api key") ||
        lower.includes("authentication") ||
        lower.includes("401") ||
        lower.includes("403")
      ) {
        msg = "Falha de autenticação com a Vapi. Verifique a chave VAPI_PRIVATE_KEY.";
      } else if (
        lower.includes("e.164") ||
        lower.includes("invalid") ||
        lower.includes("number")
      ) {
        msg =
          "Número inválido. Digite no formato internacional com código do país (ex: +5511999998888).";
      }
      toast.error(msg);
    },
  });

  const effectiveAssistantId = assistantId ?? selectedAssistant;
  const canCall =
    !!effectiveAssistantId &&
    !!selectedPhoneId &&
    /^\+[1-9]\d{6,14}$/.test(customerNumber.replace(/[\s-]/g, ""));

  const handleCall = () => {
    if (!effectiveAssistantId) {
      toast.error("Selecione uma atendente.");
      return;
    }
    const cleaned = customerNumber.replace(/[\s-]/g, "");
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      toast.error(
        "Digite o número no formato internacional com código do país (ex: +5511999998888).",
      );
      return;
    }
    callMutation.mutate({
      assistantId: effectiveAssistantId,
      phoneNumberId: selectedPhoneId,
      customerNumber: cleaned,
    });
  };

  return (
    <Card className="border-white/[0.08] bg-background/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PhoneCall className="h-4 w-4 text-primary" />
          Teste de Voz por Telefone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!assistantId ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Atendente</Label>
            <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    assistantsQuery.isLoading ? "Carregando..." : "Selecione a atendente"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(assistantsQuery.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-xs">Número de Origem</Label>
          <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  phonesQuery.isLoading
                    ? "Carregando..."
                    : phones.length === 0
                      ? "Nenhum número cadastrado na Vapi"
                      : "Selecione o número"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {phones.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.number}
                  {p.name ? ` — ${p.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Seu celular (E.164)</Label>
          <Input
            placeholder="+5511999998888"
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
          <p className="text-[11px] text-muted-foreground">
            Use o número já verificado na Twilio como Verified Caller ID.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={handleCall}
          disabled={!canCall || callMutation.isPending}
        >
          {callMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ligando...
            </>
          ) : (
            <>
              <PhoneCall className="mr-2 h-4 w-4" />
              Me Ligar Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
