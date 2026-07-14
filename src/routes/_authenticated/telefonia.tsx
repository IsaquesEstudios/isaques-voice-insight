import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  PhoneCall,
  ShieldCheck,
  AlertTriangle,
  Globe2,
  MoreVertical,
  Circle,
  Signal,
  Loader2,
  LogOut,
  Trash2,
  Info,
  Copy,
  Check,
  Link2,
  ChevronsUpDown,
  RefreshCw,
} from "lucide-react";

import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/integrations/supabase/client";
import {
  checkVerifyOtp,
  connectExternalNumber,
  deleteVerifiedCallerId,
  disconnectTwilio,
  getTwilioConnection,
  listMyNumbers,
  listTwilioNumbers,
  listTwilioTrunks,
  listVerifiedCallerIds,
  purchaseTwilioNumber,
  releaseNumber,
  saveTwilioCredentials,
  searchAvailableTwilioNumbers,
  sendVerifyOtp,
} from "@/lib/twilio.functions";




import {
  attachAssistantToNumber,
  createOutboundTestCall,
  detachAssistantFromNumber,
  listVapiAssistants,
  listVapiPhoneNumbers,
} from "@/lib/vapi.functions";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Bot } from "lucide-react";


export const Route = createFileRoute("/_authenticated/telefonia")({
  head: () => ({
    meta: [{ title: "Telefonia & Números — Isaques Estúdios | AI Voice" }],
  }),
  component: TelefoniaPage,
});

type Health = "Seguro" | "Descanso" | "Risco";

interface NumberRow {
  id: string;
  phone_number: string;
  region: string | null;
  provider: string;
  assistant: string | null;
  calls_today: number;
  answer_rate: number;
  health: Health;
}

const healthStyles: Record<Health, string> = {
  Seguro: "bg-success/15 text-success",
  Descanso: "bg-chart-3/15 text-chart-3",
  Risco: "bg-destructive/15 text-destructive",
};


const areaCodeConfig: Record<string, { maxLength: number; placeholder: string; label: string }> = {
  BR: { maxLength: 2, placeholder: "11", label: "DDD (2 dígitos)" },
  US: { maxLength: 3, placeholder: "415", label: "Area Code (3 dígitos)" },
  CA: { maxLength: 3, placeholder: "416", label: "Area Code (3 dígitos)" },
  GB: { maxLength: 5, placeholder: "20", label: "STD Code (até 5 dígitos)" },
};

interface AvailableNumber {
  id: string;
  phoneNumber: string;
  region: string;
  countryIso: string;
  voice: boolean;
  sms: boolean;
  mms: boolean;
}

function TelefoniaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listAssistantsFn = useServerFn(listVapiAssistants);
  const listVapiPhoneNumbersFn = useServerFn(listVapiPhoneNumbers);
  const attachAssistantFn = useServerFn(attachAssistantToNumber);
  const detachAssistantFn = useServerFn(detachAssistantFromNumber);

  const listFn = useServerFn(listMyNumbers);
  const releaseFn = useServerFn(releaseNumber);
  const connectSipFn = useServerFn(connectExternalNumber);
  const saveCredsFn = useServerFn(saveTwilioCredentials);
  const getConnFn = useServerFn(getTwilioConnection);
  const disconnectFn = useServerFn(disconnectTwilio);
  const listTwilioNumbersFn = useServerFn(listTwilioNumbers);
  const listTwilioTrunksFn = useServerFn(listTwilioTrunks);
  const listVerifiedCallerIdsFn = useServerFn(listVerifiedCallerIds);
  const deleteVerifiedCallerIdFn = useServerFn(deleteVerifiedCallerId);
  const sendVerifyOtpFn = useServerFn(sendVerifyOtp);
  const checkVerifyOtpFn = useServerFn(checkVerifyOtp);




  const numbersQuery = useQuery({
    queryKey: ["my-numbers"],
    queryFn: () => listFn(),
  });

  const twilioConnQuery = useQuery({
    queryKey: ["twilio-connection"],
    queryFn: () => getConnFn(),
  });

  const userQuery = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await getSupabaseBrowser().auth.getUser();
      return data.user?.id ?? "";
    },
  });

  const twilioConn = twilioConnQuery.data;
  const isTwilioConnected = twilioConn?.connected === true;

  const twilioNumbersQuery = useQuery({
    queryKey: ["twilio-numbers-live"],
    queryFn: () => listTwilioNumbersFn(),
    enabled: isTwilioConnected,
  });
  const twilioTrunksQuery = useQuery({
    queryKey: ["twilio-trunks-live"],
    queryFn: () => listTwilioTrunksFn(),
    enabled: isTwilioConnected,
  });

  const assistantsQuery = useQuery({
    queryKey: ["vapi-assistants"],
    queryFn: () => listAssistantsFn(),
  });
  const vapiPhoneNumbersQuery = useQuery({
    queryKey: ["vapi-phone-numbers"],
    queryFn: () => listVapiPhoneNumbersFn(),
  });

  const assistantById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assistantsQuery.data ?? []) {
      map.set(a.id, a.name ?? "Sem nome");
    }
    return map;
  }, [assistantsQuery.data]);

  const assistantByPhone = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of vapiPhoneNumbersQuery.data ?? []) {
      if (n.number && n.assistantId) map.set(n.number, n.assistantId);
    }
    return map;
  }, [vapiPhoneNumbersQuery.data]);

  const localNumbers = (numbersQuery.data ?? []) as NumberRow[];
  const liveTwilio =
    twilioNumbersQuery.data && "ok" in twilioNumbersQuery.data && twilioNumbersQuery.data.ok
      ? twilioNumbersQuery.data.numbers
      : [];
  const liveTrunks =
    twilioTrunksQuery.data && "ok" in twilioTrunksQuery.data && twilioTrunksQuery.data.ok
      ? twilioTrunksQuery.data.trunks
      : [];

  // Merge: Twilio live numbers are the source of truth for connected accounts;
  // fall back to local rows (e.g. SIP BYOC) when no Twilio credentials.
  const numbers: NumberRow[] = isTwilioConnected
    ? liveTwilio.map((n) => {
        const local = localNumbers.find((l) => l.phone_number === n.phoneNumber);
        const assistantId = assistantByPhone.get(n.phoneNumber);
        const assistantName = assistantId ? assistantById.get(assistantId) ?? null : null;
        return {
          id: local?.id ?? n.sid,
          phone_number: n.phoneNumber,
          region: local?.region ?? null,
          provider: "Twilio (Sua conta)",
          assistant: assistantName ?? local?.assistant ?? null,
          calls_today: local?.calls_today ?? 0,
          answer_rate: local?.answer_rate ?? 0,
          health: "Seguro" as Health,
        };
      })
    : localNumbers.map((n) => {
        const assistantId = assistantByPhone.get(n.phone_number);
        const assistantName = assistantId ? assistantById.get(assistantId) ?? null : null;
        return { ...n, assistant: assistantName ?? n.assistant };
      });


  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"twilio" | "buy" | "sip">("twilio");
  const [releaseTarget, setReleaseTarget] = useState<NumberRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<NumberRow | null>(null);
  const [assignAssistantId, setAssignAssistantId] = useState<string>("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testContactOpen, setTestContactOpen] = useState(false);
  const [testContactForm, setTestContactForm] = useState({ label: "", phoneE164: "" });
  const [verifyStep, setVerifyStep] = useState<"form" | "code">("form");
  const [verifyState, setVerifyState] = useState<{
    phoneE164: string;
    label: string;
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifyStarting, setVerifyStarting] = useState(false);
  const [verifyChecking, setVerifyChecking] = useState(false);
  const [callingContactId, setCallingContactId] = useState<string | null>(null);

  // Per-row call controls (assistant only; origin number chosen automatically)
  const [rowCallAssistant, setRowCallAssistant] = useState<Record<string, string>>({});

  const outboundCallFn = useServerFn(createOutboundTestCall);

  const testContactsQuery = useQuery({
    queryKey: ["verified-caller-ids"],
    queryFn: () => listVerifiedCallerIdsFn(),
    enabled: isTwilioConnected,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const testContacts = (testContactsQuery.data ?? []).map((c) => ({
    id: c.sid,
    label: c.friendly_name || c.phone_number,
    phone_e164: c.phone_number,
    verified: true,
  }));


  const removeTestContactMutation = useMutation({
    mutationFn: (sid: string) => deleteVerifiedCallerIdFn({ data: { sid } }),
    onSuccess: async () => {
      toast.success("Caller ID removido da sua conta Twilio.");
      await queryClient.invalidateQueries({ queryKey: ["verified-caller-ids"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao remover Caller ID"),
  });

  // Reset verification state whenever the modal closes.
  const resetVerification = () => {
    setVerifyStep("form");
    setVerifyState(null);
    setOtpCode("");
    setVerifyStarting(false);
    setVerifyChecking(false);
  };

  const startVerification = async () => {
    const label = testContactForm.label.trim();
    const phone = testContactForm.phoneE164.trim();
    if (!label) return toast.error("Informe uma identificação.");
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
      return toast.error("Número inválido. Use formato E.164 (ex: +5511999999999).");

    setVerifyStarting(true);
    try {
      const res = await sendVerifyOtpFn({
        data: { phoneE164: phone, channel: "sms" },
      });
      if (!res.ok) {
        if (res.reason === "no_credentials") {
          toast.error("Conecte sua conta Twilio primeiro.");
        } else if (res.reason === "trial_unverified") {
          toast.error(
            "Conta trial da Twilio: cadastre o número em Verified Caller IDs no Console Twilio antes de enviar o SMS.",
            { duration: 8000 },
          );
        } else {
          toast.error(
            `Erro Twilio: ${("message" in res && res.message) || "falha desconhecida"}`,
          );
        }
        return;
      }
      setVerifyState({ phoneE164: phone, label });
      setOtpCode("");
      setVerifyStep("code");
      toast.success("SMS enviado! Digite o código recebido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar SMS");
    } finally {
      setVerifyStarting(false);
    }
  };

  const confirmOtp = async () => {
    if (!verifyState) return;
    const code = otpCode.trim();
    if (!/^\d{4,10}$/.test(code)) return toast.error("Digite o código recebido por SMS.");
    setVerifyChecking(true);
    try {
      const res = await checkVerifyOtpFn({
        data: {
          phoneE164: verifyState.phoneE164,
          code,
          label: verifyState.label,
        },
      });
      if (!res.ok) {
        if (res.reason === "invalid_code") toast.error("Código incorreto. Tente novamente.");
        else if (res.reason === "expired")
          toast.error("Código expirado. Reenvie o SMS.");
        else if (res.reason === "no_credentials")
          toast.error("Conecte sua conta Twilio primeiro.");
        else
          toast.error(
            `Erro Twilio: ${("message" in res && res.message) || "falha ao validar"}`,
          );
        return;
      }
      toast.success("Número verificado e salvo!");
      await queryClient.invalidateQueries({ queryKey: ["test-contacts"] });
      setTestContactOpen(false);
      setTestContactForm({ label: "", phoneE164: "" });
      resetVerification();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao validar código");
    } finally {
      setVerifyChecking(false);
    }
  };



  const testCallMutation = useMutation({
    mutationFn: (contact: { id: string; phone_e164: string }) => {
      setCallingContactId(contact.id);
      const assistantId = rowCallAssistant[contact.id];
      const fromNumberE164 = numbers[0]?.phone_number ?? "";
      if (!assistantId) {
        setCallingContactId(null);
        return Promise.reject(new Error("Selecione uma assistente."));
      }
      if (!fromNumberE164) {
        setCallingContactId(null);
        return Promise.reject(
          new Error("Conecte um número em 'Conectar Número' antes de testar a ligação."),
        );
      }
      return outboundCallFn({
        data: {
          assistantId,
          fromNumberE164,
          customerNumber: contact.phone_e164,
        },
      });
    },
    onSuccess: () =>
      toast.success(
        "Chamada iniciada! Atenda o celular e, se solicitado, pressione qualquer tecla.",
      ),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao iniciar chamada"),
    onSettled: () => setCallingContactId(null),
  });






  const [twilioForm, setTwilioForm] = useState({
    accountSid: "",
    authToken: "",
  });
  const [sipForm, setSipForm] = useState({ routeName: "" });

  const sipUri = useMemo(() => {
    const slug = (userQuery.data ?? "anon").replace(/-/g, "").slice(0, 12);
    return `sip:${slug}@sip.vapi.ai`;
  }, [userQuery.data]);

  // ---- Comprar número Twilio ----
  const searchTwilioFn = useServerFn(searchAvailableTwilioNumbers);
  const purchaseTwilioFn = useServerFn(purchaseTwilioNumber);
  const [buyForm, setBuyForm] = useState({
    countryCode: "US",
    areaCode: "",
    contains: "",
  });
  const [buyResults, setBuyResults] = useState<
    Array<{
      phoneNumber: string;
      friendlyName: string;
      locality: string | null;
      region: string | null;
      country: string;
      voice: boolean;
      sms: boolean;
    }>
  >([]);
  const [buySearching, setBuySearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState<string | null>(null);

  const handleSearchTwilio = async () => {
    setBuySearching(true);
    try {
      const res = await searchTwilioFn({
        data: {
          countryCode: (buyForm.countryCode || "US").toUpperCase(),
          areaCode: buyForm.areaCode.trim() || undefined,
          contains: buyForm.contains.trim() || undefined,
        },
      });
      if (!res.ok) {
        if (res.reason === "no_credentials") {
          toast.error("Conecte sua conta Twilio primeiro.");
          setTab("twilio");
        } else {
          toast.error(res.message ?? "Falha ao buscar números na Twilio.");
        }
        setBuyResults([]);
        return;
      }
      setBuyResults(res.numbers);
      if (res.numbers.length === 0) {
        toast.info("Nenhum número encontrado. Ajuste país / DDD / contém e tente novamente.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na busca.");
    } finally {
      setBuySearching(false);
    }
  };

  const handleBuyTwilio = async (phoneNumber: string) => {
    setBuyingNumber(phoneNumber);
    try {
      const res = await purchaseTwilioFn({ data: { phoneNumber } });
      if (!("ok" in res) || !res.ok) {
        toast.error(res.message ?? "Não foi possível comprar este número.");
        return;
      }
      toast.success(`Número ${res.phoneNumber} adquirido na Twilio!`);
      setBuyResults((prev) => prev.filter((n) => n.phoneNumber !== phoneNumber));
      await queryClient.invalidateQueries({ queryKey: ["twilio-numbers-live"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao comprar número.");
    } finally {
      setBuyingNumber(null);
    }
  };

  const resetModal = () => {
    setTab("twilio");
    setTwilioForm({ accountSid: "", authToken: "" });
    setSipForm({ routeName: "" });
    setCopied(false);
    setBuyResults([]);
    setBuyForm({ countryCode: "US", areaCode: "", contains: "" });
  };

  const handleCopySip = async () => {
    try {
      await navigator.clipboard.writeText(sipUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleConnectTwilio = async () => {
    setConnecting(true);
    try {
      await saveCredsFn({
        data: {
          accountSid: twilioForm.accountSid.trim(),
          authToken: twilioForm.authToken.trim(),
        },
      });
      toast.success("Conta Twilio conectada com sucesso!");
      await queryClient.invalidateQueries({ queryKey: ["twilio-connection"] });
      await queryClient.invalidateQueries({ queryKey: ["twilio-numbers-live"] });
      await queryClient.invalidateQueries({ queryKey: ["twilio-trunks-live"] });
      setOpen(false);
      resetModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao conectar Twilio");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectSip = async () => {
    setConnecting(true);
    try {
      await connectSipFn({
        data: {
          routeName: sipForm.routeName.trim(),
          sipUri,
        },
      });
      toast.success("Rota SIP conectada com sucesso!");
      await queryClient.invalidateQueries({ queryKey: ["my-numbers"] });
      setOpen(false);
      resetModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar rota SIP");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: async () => {
      toast.success("Conta Twilio desconectada.");
      await queryClient.invalidateQueries({ queryKey: ["twilio-connection"] });
      setConfirmDisconnect(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao desconectar Twilio"),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => releaseFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Número liberado da sua conta.");
      queryClient.invalidateQueries({ queryKey: ["my-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["twilio-numbers-live"] });
      setReleaseTarget(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao liberar número"),
  });

  const attachAssistantMutation = useMutation({
    mutationFn: (input: {
      phoneNumberE164: string;
      assistantId: string;
      name?: string;
      assistantName?: string;
    }) =>
      attachAssistantFn({
        data: {
          phoneNumberE164: input.phoneNumberE164,
          assistantId: input.assistantId,
          name: input.name,
        },
      }),
    onSuccess: async (res, variables) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        `Número roteado com sucesso para o assistente ${variables.assistantName ?? "selecionado"}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["vapi-phone-numbers"] });
      await queryClient.invalidateQueries({ queryKey: ["my-numbers"] });
      setAssignTarget(null);
      setAssignAssistantId("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao vincular atendente"),
  });

  const detachAssistantMutation = useMutation({
    mutationFn: (phoneNumberE164: string) =>
      detachAssistantFn({ data: { phoneNumberE164 } }),
    onSuccess: async () => {
      toast.success("Atendente removida do número.");
      await queryClient.invalidateQueries({ queryKey: ["vapi-phone-numbers"] });
      await queryClient.invalidateQueries({ queryKey: ["my-numbers"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao remover atendente"),
  });




  const handleSignOut = async () => {
    const supabase = getSupabaseBrowser();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const kpis = [
    {
      label: "Números ativos",
      value: String(numbers.length),
      icon: PhoneCall,
      tone: "text-primary",
    },
    {
      label: "Seguros",
      value: String(numbers.filter((n) => n.health === "Seguro").length),
      icon: ShieldCheck,
      tone: "text-success",
    },
    {
      label: "Em descanso",
      value: String(numbers.filter((n) => n.health === "Descanso").length),
      icon: Signal,
      tone: "text-chart-3",
    },
    {
      label: "Risco de spam",
      value: String(numbers.filter((n) => n.health === "Risco").length),
      icon: AlertTriangle,
      tone: "text-destructive",
    },
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Telefonia & Números
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestão de rotas, DIDs e políticas anti-spam.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isTwilioConnected && twilioConn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Twilio: {twilioConn.accountSid.slice(0, 8)}…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair da conta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Entrar em outra conta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setConfirmDisconnect(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Desconectar Twilio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button
              className="gap-2 shadow-glow"
              onClick={() => {
                resetModal();
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Conectar Número
            </Button>
          </div>

        </div>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                </div>
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-background/60", k.tone)}>
                  <k.icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>





        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Números (DIDs)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead className="px-6">Número</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Assistente</TableHead>
                      <TableHead>Hoje</TableHead>
                      <TableHead>Atendimento</TableHead>
                      <TableHead>Saúde</TableHead>
                      <TableHead className="px-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numbersQuery.isLoading || (isTwilioConnected && twilioNumbersQuery.isLoading) ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i} className="border-border/50">
                          <TableCell className="px-6">
                            <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
                          </TableCell>
                          <TableCell colSpan={6}>
                            <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : numbers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          Nenhum número ainda. Clique em <b>Adquirir número</b> para começar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      numbers.map((n) => (
                        <TableRow
                          key={n.id}
                          className="border-border/50 transition-colors hover:bg-primary/5"
                        >
                          <TableCell className="px-6">
                            <p className="font-mono text-xs font-medium text-foreground">
                              {n.phone_number}
                            </p>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {n.provider}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {n.region ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-foreground">
                            <AssistantCombobox
                              phoneNumberE164={n.phone_number}
                              phoneLabel={n.phone_number}
                              currentAssistantId={
                                assistantByPhone.get(n.phone_number) ?? null
                              }
                              currentAssistantName={n.assistant}
                              assistants={assistantsQuery.data ?? []}
                              isLoading={assistantsQuery.isLoading}
                              onAttach={(assistantId, assistantName) =>
                                attachAssistantMutation.mutate({
                                  phoneNumberE164: n.phone_number,
                                  assistantId,
                                  name: n.phone_number,
                                  assistantName,
                                })
                              }
                              onDetach={() =>
                                detachAssistantMutation.mutate(n.phone_number)
                              }
                              isPending={
                                (attachAssistantMutation.isPending &&
                                  attachAssistantMutation.variables?.phoneNumberE164 ===
                                    n.phone_number) ||
                                (detachAssistantMutation.isPending &&
                                  detachAssistantMutation.variables === n.phone_number)
                              }
                            />
                          </TableCell>


                          <TableCell className="text-xs">{n.calls_today}</TableCell>
                          <TableCell className="text-xs">
                            {n.answer_rate > 0 ? `${n.answer_rate}%` : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                healthStyles[n.health],
                              )}
                            >
                              <Circle className="h-1.5 w-1.5 fill-current" />
                              {n.health}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAssignTarget(n);
                                    setAssignAssistantId(
                                      assistantByPhone.get(n.phone_number) ?? "",
                                    );
                                  }}
                                >
                                  <Bot className="mr-2 h-4 w-4" />
                                  {n.assistant ? "Alterar atendente" : "Atribuir atendente"}
                                </DropdownMenuItem>
                                {n.assistant ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      detachAssistantMutation.mutate(n.phone_number)
                                    }
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remover atendente
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  onClick={() => setReleaseTarget(n)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Liberar número
                                </DropdownMenuItem>
                              </DropdownMenuContent>

                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Contatos de teste</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Caller IDs verificados diretamente na sua conta Twilio.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  disabled={!isTwilioConnected || testContactsQuery.isFetching}
                  onClick={() => testContactsQuery.refetch()}
                  title="Atualizar lista"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${testContactsQuery.isFetching ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button size="sm" variant="outline" asChild className="gap-1.5">
                  <a
                    href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Plus className="h-4 w-4" /> Verificar na Twilio
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isTwilioConnected && (
                <Alert className="border-warning/30 bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    Conecte sua conta Twilio para listar seus Caller IDs verificados.
                  </AlertDescription>
                </Alert>
              )}

              {isTwilioConnected && testContactsQuery.isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                  />
                ))
              ) : isTwilioConnected && testContacts.length === 0 ? (
                <div className="space-y-2 py-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum Caller ID verificado encontrado na sua conta Twilio.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Verifique um número em <b>Console → Phone Numbers → Verified Caller IDs</b> e clique em atualizar.
                  </p>
                </div>
              ) : (
                testContacts.map((c) => {
                  const from = numbers[0]?.phone_number ?? "";
                  const assistantId = rowCallAssistant[c.id] ?? "";
                  return (
                    <div
                      key={c.id}
                      className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {c.label}
                            </p>
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                              Verificado
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {c.phone_e164}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeTestContactMutation.mutate(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {numbers.length === 0 ? (
                          <Alert className="border-warning/30 bg-warning/10 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            <AlertDescription className="text-[11px] text-muted-foreground">
                              Nenhum número conectado à Vapi. Vá em "Conectar Número" para poder disparar testes.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            Origem automática: <span className="font-mono">{from}</span>
                          </p>
                        )}
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Assistente
                          </Label>
                          <Select
                            value={assistantId}
                            onValueChange={(v) =>
                              setRowCallAssistant((prev) => ({ ...prev, [c.id]: v }))
                            }
                          >
                            <SelectTrigger className="h-9 border-white/[0.08] bg-background/40 backdrop-blur-xl">
                              <SelectValue placeholder="Selecione uma assistente" />
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
                        <Button
                          size="sm"
                          className="w-full gap-1.5 shadow-glow"
                          disabled={
                            !isTwilioConnected ||
                            !from ||
                            !assistantId ||
                            callingContactId === c.id
                          }
                          onClick={() =>
                            testCallMutation.mutate({
                              id: c.id,
                              phone_e164: c.phone_e164,
                            })
                          }
                        >
                          {callingContactId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PhoneCall className="h-3.5 w-3.5" />
                          )}
                          Ligar
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Rotas ativas (Twilio Trunks)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {!isTwilioConnected ? (
              <p className="text-xs text-muted-foreground">
                Conecte sua conta Twilio para listar suas Elastic SIP Trunks.
              </p>
            ) : twilioTrunksQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                />
              ))
            ) : liveTrunks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum trunk encontrado na sua conta Twilio.
              </p>
            ) : (
              liveTrunks.map((r) => {
                const load = Math.min(100, r.numbersCount * 10);
                return (
                  <div
                    key={r.sid}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        {r.friendlyName}
                      </p>
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.numbersCount} números vinculados
                      {r.domainName ? ` • ${r.domainName}` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            load > 85
                              ? "bg-destructive"
                              : load > 60
                                ? "bg-chart-3"
                                : "bg-primary",
                          )}
                          style={{ width: `${load}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {load}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>





      <Dialog
        open={testContactOpen}
        onOpenChange={(o) => {
          setTestContactOpen(o);
          if (!o) {
            setTestContactForm({ label: "", phoneE164: "" });
            resetVerification();
          }
        }}
      >
        <DialogContent className="max-w-md border-white/[0.08] bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Novo contato de teste</DialogTitle>
            <DialogDescription>
              Enviaremos um SMS via Twilio Verify com um código de 6 dígitos.
              Digite o código para confirmar que o número é seu.
            </DialogDescription>
          </DialogHeader>

          {verifyStep === "form" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Identificação</Label>
                <Input
                  placeholder="Ex: Meu celular"
                  value={testContactForm.label}
                  onChange={(e) =>
                    setTestContactForm((f) => ({ ...f, label: e.target.value }))
                  }
                  disabled={verifyStarting}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número (E.164)</Label>
                <Input
                  placeholder="+5511999999999"
                  value={testContactForm.phoneE164}
                  onChange={(e) =>
                    setTestContactForm((f) => ({ ...f, phoneE164: e.target.value }))
                  }
                  disabled={verifyStarting}
                />
                <p className="text-[10px] text-muted-foreground">
                  Inclua o código do país (+55 para Brasil).
                </p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={startVerification}
                disabled={verifyStarting || !isTwilioConnected}
              >
                {verifyStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="h-4 w-4" />
                )}
                Enviar SMS de verificação
              </Button>
              {!isTwilioConnected && (
                <p className="text-center text-[11px] text-warning">
                  Conecte sua conta Twilio antes de verificar um número.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Enviamos um SMS para{" "}
                  <span className="font-mono text-foreground">{verifyState?.phoneE164}</span>.
                  Digite abaixo o código recebido.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código de verificação</Label>
                <Input
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  disabled={verifyChecking}
                  className="font-mono text-center text-xl tracking-[0.4em]"
                  maxLength={10}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetVerification}
                  disabled={verifyChecking}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={confirmOtp}
                  disabled={verifyChecking || otpCode.length < 4}
                >
                  {verifyChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Validar código
                </Button>
              </div>
              <button
                type="button"
                onClick={startVerification}
                disabled={verifyStarting}
                className="w-full text-center text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {verifyStarting ? "Reenviando..." : "Reenviar SMS"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>








      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetModal();
        }}
      >
        <DialogContent className="max-w-xl border-white/[0.08] bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Conectar Número de Telefonia</DialogTitle>
            <DialogDescription>
              Para garantir a conformidade com as regras locais (Anatel/Regulamentação),
              utilize os dados da sua própria operadora. Nós cuidamos da inteligência artificial.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "twilio" | "buy" | "sip")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="twilio">Credenciais</TabsTrigger>
              <TabsTrigger value="buy" disabled={!isTwilioConnected}>
                Comprar número
              </TabsTrigger>
              <TabsTrigger value="sip">SIP Trunk</TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="mt-4 space-y-4">
              <Alert className="border-primary/30 bg-primary/10 text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Pesquise e compre um número na sua conta Twilio. Contas trial só podem
                  usar o número gratuito emitido no cadastro — para adquirir novos,
                  faça upgrade da conta Twilio.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <Label className="text-[11px] text-muted-foreground">País (ISO-2)</Label>
                  <Input
                    value={buyForm.countryCode}
                    maxLength={2}
                    onChange={(e) =>
                      setBuyForm({ ...buyForm, countryCode: e.target.value.toUpperCase() })
                    }
                    placeholder="US"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px] text-muted-foreground">DDD / Area code</Label>
                  <Input
                    value={buyForm.areaCode}
                    onChange={(e) => setBuyForm({ ...buyForm, areaCode: e.target.value })}
                    placeholder="415"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[11px] text-muted-foreground">Contém dígitos</Label>
                  <Input
                    value={buyForm.contains}
                    onChange={(e) => setBuyForm({ ...buyForm, contains: e.target.value })}
                    placeholder="7777"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSearchTwilio}
                  disabled={buySearching}
                  variant="outline"
                  className="gap-2"
                >
                  {buySearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Signal className="h-4 w-4" />
                  )}
                  Pesquisar
                </Button>
              </div>

              {buyResults.length > 0 && (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-white/[0.08] bg-background/40 p-2">
                  {buyResults.map((n) => (
                    <div
                      key={n.phoneNumber}
                      className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-card/40 p-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm">{n.phoneNumber}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[n.locality, n.region, n.country].filter(Boolean).join(" · ") || "—"}
                          {n.voice ? " · Voz" : ""}
                          {n.sms ? " · SMS" : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleBuyTwilio(n.phoneNumber)}
                        disabled={buyingNumber !== null}
                        className="gap-1.5"
                      >
                        {buyingNumber === n.phoneNumber ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Comprar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>


            <TabsContent value="twilio" className="mt-4 space-y-4">
              <Alert className="border-primary/30 bg-primary/10 text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Conecte sua conta Twilio. Os custos de telefonia e a titularidade dos
                  números serão gerenciados diretamente no seu painel da Twilio.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Twilio Account SID</Label>
                  <Input
                    placeholder="AC..."
                    value={twilioForm.accountSid}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) =>
                      setTwilioForm({ ...twilioForm, accountSid: e.target.value.trim() })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Twilio Auth Token</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={twilioForm.authToken}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) =>
                      setTwilioForm({ ...twilioForm, authToken: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleConnectTwilio}
                  disabled={
                    connecting ||
                    !/^AC[a-zA-Z0-9]{10,}$/.test(twilioForm.accountSid) ||
                    twilioForm.authToken.length < 8
                  }
                  className="gap-2"
                >

                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Conectar Twilio
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="sip" className="mt-4 space-y-4">
              <Alert className="border-primary/30 bg-primary/10 text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Aponte o tráfego da sua operadora atual (Zenvia, Vonage, PABX) para
                  o nosso SIP URI.
                </AlertDescription>
              </Alert>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Seu SIP URI de Destino
                </Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={sipUri} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopySip}
                    className="shrink-0"
                    aria-label="Copiar SIP URI"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Nome da Rota</Label>
                <Input
                  placeholder="Ex: Central de Vendas SP"
                  value={sipForm.routeName}
                  maxLength={80}
                  onChange={(e) => setSipForm({ routeName: e.target.value })}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleConnectSip}
                  disabled={connecting || sipForm.routeName.trim().length < 2}
                  className="gap-2"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Gerar SIP URI
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={releaseTarget !== null}
        onOpenChange={(o) => {
          if (!o) setReleaseTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar este número?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove <span className="font-mono">{releaseTarget?.phone_number}</span> da
              sua conta. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releaseMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (releaseTarget) releaseMutation.mutate(releaseTarget.id);
              }}
              disabled={releaseMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {releaseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Liberando...
                </>
              ) : (
                "Liberar número"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(o) => {
          if (!o) setConfirmDisconnect(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar conta Twilio?</AlertDialogTitle>
            <AlertDialogDescription>
              Suas credenciais Twilio serão removidas deste app. Os números já
              cadastrados continuam listados, mas novas buscas e compras ficarão
              bloqueadas até você reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                disconnectMutation.mutate();
              }}
              disabled={disconnectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                "Desconectar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={assignTarget !== null}
        onOpenChange={(v) => {
          if (!v) {
            setAssignTarget(null);
            setAssignAssistantId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir atendente ao número</DialogTitle>
            <DialogDescription>
              {assignTarget ? (
                <>
                  Escolha qual atendente virtual atenderá as chamadas recebidas em{" "}
                  <span className="font-mono text-foreground">
                    {assignTarget.phone_number}
                  </span>
                  .
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Atendente</Label>
            <Select
              value={assignAssistantId}
              onValueChange={setAssignAssistantId}
              disabled={assistantsQuery.isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    assistantsQuery.isLoading
                      ? "Carregando atendentes…"
                      : "Selecione uma atendente"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(assistantsQuery.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? "Sem nome"}
                    {a.model?.model ? (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {a.model.provider}/{a.model.model}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
                {(assistantsQuery.data ?? []).length === 0 && !assistantsQuery.isLoading ? (
                  <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma atendente encontrada. Crie uma em Assistentes Virtuais.
                  </div>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAssignTarget(null);
                setAssignAssistantId("");
              }}
              disabled={attachAssistantMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!assignTarget || !assignAssistantId) return;
                attachAssistantMutation.mutate({
                  phoneNumberE164: assignTarget.phone_number,
                  assistantId: assignAssistantId,
                  name: assignTarget.phone_number,
                  assistantName:
                    assistantById.get(assignAssistantId) ?? "selecionado",
                });
              }}
              disabled={!assignAssistantId || attachAssistantMutation.isPending}
              className="gap-2"
            >
              {attachAssistantMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Vincular
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>



  );
}

interface AssistantComboboxProps {
  phoneNumberE164: string;
  phoneLabel: string;
  currentAssistantId: string | null;
  currentAssistantName: string | null;
  assistants: Array<{ id: string; name?: string | null }>;
  isLoading: boolean;
  isPending: boolean;
  onAttach: (assistantId: string, assistantName: string) => void;
  onDetach: () => void;
}

function AssistantCombobox({
  currentAssistantId,
  currentAssistantName,
  assistants,
  isLoading,
  isPending,
  onAttach,
  onDetach,
}: AssistantComboboxProps) {
  const [open, setOpen] = useState(false);
  const hasAssistant = Boolean(currentAssistantId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60",
            hasAssistant
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "border border-dashed border-emerald-500/30 text-emerald-400/90 hover:border-emerald-500/60 hover:text-emerald-300",
          )}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : hasAssistant ? (
            <Bot className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          <span className="truncate max-w-[140px]">
            {hasAssistant ? currentAssistantName ?? "Assistente" : "Vincular Assistente"}
          </span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar assistente..." className="h-9" />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Carregando..." : "Nenhum assistente encontrado."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  setOpen(false);
                  if (hasAssistant) onDetach();
                }}
                className="text-xs"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Nenhum (Desvincular)
                {!hasAssistant ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Assistentes">
              {assistants.map((a) => {
                const name = a.name ?? "Sem nome";
                const isCurrent = a.id === currentAssistantId;
                return (
                  <CommandItem
                    key={a.id}
                    value={`${name} ${a.id}`}
                    onSelect={() => {
                      setOpen(false);
                      if (!isCurrent) onAttach(a.id, name);
                    }}
                    className="text-xs"
                  >
                    <Bot className="mr-2 h-3.5 w-3.5" />
                    <span className="truncate">{name}</span>
                    {isCurrent ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
