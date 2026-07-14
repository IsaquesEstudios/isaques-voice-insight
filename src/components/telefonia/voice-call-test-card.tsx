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
  defaultLabel?: string;
  defaultCustomerNumber?: string;
  onSuccess?: () => void;
}

/** Extract the exact Vapi error message from a thrown Error text. */
function extractVapiMessage(raw: string): string {
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const msg = parsed?.message;
      if (Array.isArray(msg)) return msg.join(", ");
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // fallthrough
    }
  }
  return raw || "Falha desconhecida";
}

export function VoiceCallTestCard({
  defaultLabel,
  defaultCustomerNumber,
  onSuccess,
}: Props) {
  const listAssistantsFn = useServerFn(listVapiAssistants);
  const listVapiPhoneNumbersFn = useServerFn(listVapiPhoneNumbers);
  const outboundCallFn = useServerFn(createOutboundTestCall);

  const assistantsQuery = useQuery({
    queryKey: ["vapi-assistants"],
    queryFn: () => listAssistantsFn(),
  });
  const phonesQuery = useQuery({
    queryKey: ["vapi-phone-numbers"],
    queryFn: () => listVapiPhoneNumbersFn(),
  });

  const phones = useMemo(
    () => (phonesQuery.data ?? []).filter((p) => p.number),
    [phonesQuery.data],
  );

  const [label, setLabel] = useState(defaultLabel ?? "");
  const [customerNumber, setCustomerNumber] = useState(defaultCustomerNumber ?? "");
  const [selectedAssistant, setSelectedAssistant] = useState("");
  const [selectedPhoneId, setSelectedPhoneId] = useState("");

  const callMutation = useMutation({
    mutationFn: (input: {
      assistantId: string;
      phoneNumberId: string;
      customerNumber: string;
    }) => outboundCallFn({ data: input }),
    onSuccess: () => {
      toast.success("Ligação disparada! Atenda o celular.");
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err ?? "");
      const message = extractVapiMessage(raw);
      toast.error(`Erro na Vapi: ${message}`);
    },
  });

  const cleanedNumber = customerNumber.replace(/[\s-]/g, "");
  const canCall =
    !!label.trim() &&
    !!selectedAssistant &&
    !!selectedPhoneId &&
    /^\+[1-9]\d{6,14}$/.test(cleanedNumber);

  const handleCall = () => {
    if (!/^\+[1-9]\d{6,14}$/.test(cleanedNumber)) {
      toast.error(
        "Erro na Vapi: Digite o número no formato internacional com código do país (ex: +5511999998888).",
      );
      return;
    }
    callMutation.mutate({
      assistantId: selectedAssistant,
      phoneNumberId: selectedPhoneId,
      customerNumber: cleanedNumber,
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
        <div className="space-y-1.5">
          <Label className="text-xs">Identificação</Label>
          <Input
            placeholder="Ex: Meu celular"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Número de Destino</Label>
          <Input
            placeholder="+5511999999999"
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Atendente</Label>
          <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  assistantsQuery.isLoading
                    ? "Carregando..."
                    : "Selecione a atendente"
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

        <Button
          type="button"
          className="w-full"
          onClick={handleCall}
          disabled={!canCall || callMutation.isPending}
        >
          {callMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Disparando...
            </>
          ) : (
            <>
              <PhoneCall className="mr-2 h-4 w-4" />
              Disparar Ligação de Teste
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
