import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { translateError } from "@/lib/error-messages";
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
import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import {
  listMyNumbers,
  listTestContacts,
  releaseNumber,
  removeTestContact,
  saveTestContact,
} from "@/lib/numbers.functions";


import {
  disconnectSipTrunk,
  getSipConnection,
} from "@/lib/sip.functions";




import {
  connectSipNumber,
  attachAssistantToNumber,
  createOutboundTestCall,
  detachAssistantFromNumber,
  deleteVapiPhoneNumber,
  resyncVapiNumberCredentials,

  getVapiCallStatus,

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
  isTest?: boolean;
  vapiId?: string;
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
  const deleteVapiNumberFn = useServerFn(deleteVapiPhoneNumber);


  const listFn = useServerFn(listMyNumbers);
  const releaseFn = useServerFn(releaseNumber);



  // Tronco SIP do próprio usuário (opcional)
  const getSipConnFn = useServerFn(getSipConnection);
  const connectSipNumberFn = useServerFn(connectSipNumber);
  const disconnectSipFn = useServerFn(disconnectSipTrunk);

  // Contatos de teste (armazenados localmente, sem depender de operadora)
  const listTestContactsFn = useServerFn(listTestContacts);
  const saveTestContactFn = useServerFn(saveTestContact);
  const removeTestContactFn = useServerFn(removeTestContact);




  const numbersQuery = useQuery({
    queryKey: ["my-numbers"],
    queryFn: () => listFn(),
  });

  const userQuery = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await getSupabaseBrowser().auth.getUser();
      return data.user?.id ?? "";
    },
  });


  const sipConnQuery = useQuery({
    queryKey: ["sip-connection"],
    queryFn: () => getSipConnFn(),
  });
  const sipConn = sipConnQuery.data;
  const isSipConnected = sipConn?.connected === true;




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

  const localNumbers = (numbersQuery.data ?? []) as unknown as NumberRow[];

  // Base: números registrados localmente. Os números da conta Vapi entram logo abaixo.
  const numbers: NumberRow[] = localNumbers.map((n) => {
    const assistantId = assistantByPhone.get(n.phone_number);
    const assistantName = assistantId ? assistantById.get(assistantId) ?? null : null;
    return { ...n, assistant: assistantName ?? n.assistant };
  });


  // Any number registered inside Vapi (números gratuitos da Vapi ou DIDs do tronco SIP
  // imported into Vapi) is usable as origin — append the ones not listed yet.
  for (const n of vapiPhoneNumbersQuery.data ?? []) {
    if (!n.number) continue;
    const isTest =
      n.provider === "vapi" || /teste|test|demo|gratuit/i.test(n.name ?? "");
    const existingRow = numbers.find((row) => row.phone_number === n.number);
    if (existingRow) {
      existingRow.vapiId = n.id;
      if (isTest) existingRow.isTest = true;
      continue;
    }
    numbers.push({
      id: n.id,
      vapiId: n.id,
      phone_number: n.number,
      region: null,
      provider:
        n.provider === "vapi"
          ? "Vapi (gratuito)"
          : `${n.provider ?? "Vapi"} (via Vapi)`,
      assistant: n.assistantId ? assistantById.get(n.assistantId) ?? null : null,
      calls_today: 0,
      answer_rate: 0,
      health: "Seguro" as Health,
      isTest,
    });
  }







  const [open, setOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<NumberRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<NumberRow | null>(null);
  const [assignAssistantId, setAssignAssistantId] = useState<string>("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testContactOpen, setTestContactOpen] = useState(false);
  const [testContactForm, setTestContactForm] = useState({ label: "", phoneE164: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [callingContactId, setCallingContactId] = useState<string | null>(null);

  // Per-row call controls (assistant + origin number)
  const [rowCallAssistant, setRowCallAssistant] = useState<Record<string, string>>({});
  const [rowCallFrom, setRowCallFrom] = useState<Record<string, string>>({});

  const outboundCallFn = useServerFn(createOutboundTestCall);

  // Contatos de teste ficam salvos na própria plataforma: o tronco SIP não possui
  // um serviço externo de verificação por OTP.
  const testContactsQuery = useQuery({
    queryKey: ["test-contacts"],
    queryFn: () => listTestContactsFn(),
  });
  const testContacts = (
    (testContactsQuery.data ?? []) as Array<{
      id: string;
      label: string;
      phone_e164: string;
      verified: boolean | null;
    }>
  ).map((c) => ({
    id: c.id,
    label: c.label || c.phone_e164,
    phone_e164: c.phone_e164,
    verified: Boolean(c.verified),
  }));

  const removeTestContactMutation = useMutation({
    mutationFn: (id: string) => removeTestContactFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Contato de teste removido.");
      await queryClient.invalidateQueries({ queryKey: ["test-contacts"] });
    },
    onError: (err) =>
      toast.error(translateError(err, "Falha ao remover contato")),
  });

  const handleSaveTestContact = async () => {
    const label = testContactForm.label.trim();
    const phone = testContactForm.phoneE164.trim();
    if (!label) return toast.error("Informe uma identificação.");
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
      return toast.error("Número inválido. Use formato E.164 (ex: +5511999999999).");
    setSavingContact(true);
    try {
      await saveTestContactFn({ data: { label, phoneE164: phone } });
      toast.success("Contato de teste salvo!");
      await queryClient.invalidateQueries({ queryKey: ["test-contacts"] });
      setTestContactOpen(false);
      setTestContactForm({ label: "", phoneE164: "" });
    } catch (err) {
      toast.error(translateError(err, "Falha ao salvar contato"));
    } finally {
      setSavingContact(false);
    }
  };



  const callStatusFn = useServerFn(getVapiCallStatus);
  const resyncFn = useServerFn(resyncVapiNumberCredentials);
  const resyncMutation = useMutation({
    mutationFn: (phoneNumberE164: string) => resyncFn({ data: { phoneNumberE164 } }),
    onSuccess: (res) => {
      if (res.ok) toast.success(res.message);
      else toast.error(translateError(res));
    },
    onError: (err) =>
      toast.error(translateError(err, "Falha ao ressincronizar.")),
  });

  const deleteVapiNumberMutation = useMutation({
    mutationFn: (id: string) => deleteVapiNumberFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Número removido da Vapi.");
      queryClient.invalidateQueries({ queryKey: ["vapi-phone-numbers"] });
    },
    onError: (err) =>
      toast.error(translateError(err, "Falha ao remover número.")),
  });



  const [lastCallDiag, setLastCallDiag] = useState<{
    status: string | null;
    endedReason: string | null;
  } | null>(null);

  const watchCall = async (callId: string) => {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const s = await callStatusFn({ data: { callId } });
        setLastCallDiag({ status: s.status, endedReason: s.endedReason });
        if (s.endedReason || s.status === "ended") {
          const reason = s.endedReason ?? "";
          if (/assistant-forwarded-call/.test(reason)) {
            toast.success("Chamada transferida para o número de destino.");
          } else if (reason && !/customer-ended-call|assistant-ended-call/.test(reason)) {
            toast.error(`Chamada encerrada pela Vapi: ${reason}`);
          }
          return;
        }

      } catch {
        return;
      }
    }
  };

  const testCallMutation = useMutation({
    mutationFn: (contact: { id: string; phone_e164: string }) => {
      setCallingContactId(contact.id);
      const assistantId = rowCallAssistant[contact.id];
      const fromNumberE164 =
        rowCallFrom[contact.id] || numbers[0]?.phone_number || "";
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
      setLastCallDiag(null);
      return outboundCallFn({
        data: {
          assistantId,
          fromNumberE164,
          customerNumber: contact.phone_e164,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        "Chamada iniciada! Atenda o celular e, se solicitado, pressione qualquer tecla.",
      );
      if (res?.callId) void watchCall(res.callId);
    },
    onError: (err) =>
      toast.error(translateError(err, "Falha ao iniciar chamada")),
    onSettled: () => setCallingContactId(null),
  });







  // Um único provedor: o tronco SIP do próprio usuário, com os dados que a
  // Vapi exige para o BYO SIP Trunk (gateway, usuário, senha) + o DID.
  const [sipForm, setSipForm] = useState({
    label: "",
    sipHost: "",
    sipUsername: "",
    sipPassword: "",
    apiKey: "",
    phoneNumber: "",
    friendlyName: "",
  });

  const sipUri = useMemo(() => {
    const slug = (userQuery.data ?? "anon").replace(/-/g, "").slice(0, 12);
    return `sip:${slug}@sip.vapi.ai`;
  }, [userQuery.data]);

  const resetModal = () => {
    setSipForm({
      label: "",
      sipHost: "",
      sipUsername: "",
      sipPassword: "",
      apiKey: "",
      phoneNumber: "",
      friendlyName: "",
    });
    setCopied(false);
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

  // Salva o tronco SIP do usuário e, quando informado, já cadastra o DID.
  const handleConnectSipTrunk = async () => {
    const host = sipForm.sipHost.trim();
    const user = sipForm.sipUsername.trim();
    const pass = sipForm.sipPassword.trim();
    const did = sipForm.phoneNumber.trim();
    const didName = sipForm.friendlyName.trim();
    if (host.length < 4) return toast.error("Informe o gateway/host SIP da sua operadora.");
    if (user.length < 2) return toast.error("Informe o usuário SIP.");
    if (pass.length < 4) return toast.error("Informe a senha SIP.");
    if (did.replace(/\D/g, "").length < 8)
      return toast.error("Informe o número (DID) em formato E.164, ex: +551140028922.");
    if (didName.length < 2) return toast.error("Dê um nome para identificar o número.");

    setConnecting(true);
    try {
      const res = await connectSipNumberFn({
        data: {
          sipHost: host,
          sipUsername: user,
          sipPassword: pass,
          friendlyLabel: didName || sipForm.label.trim() || undefined,
          phoneNumber: did,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Tronco SIP conectado e número validado na Vapi!");
      await queryClient.invalidateQueries({ queryKey: ["sip-connection"] });
      await queryClient.invalidateQueries({ queryKey: ["my-numbers"] });
      await queryClient.invalidateQueries({ queryKey: ["vapi-phone-numbers"] });
      setOpen(false);
      resetModal();
    } catch (err) {
      toast.error(translateError(err, "Falha ao conectar o tronco SIP"));
    } finally {
      setConnecting(false);
    }
  };


  const disconnectMutation = useMutation({
    mutationFn: () => disconnectSipFn(),
    onSuccess: async () => {
      toast.success("Tronco SIP desconectado.");
      await queryClient.invalidateQueries({ queryKey: ["sip-connection"] });
      setConfirmDisconnect(false);
    },
    onError: (err) =>
      toast.error(translateError(err, "Falha ao desconectar o tronco SIP")),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => releaseFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Número liberado da sua conta.");
      queryClient.invalidateQueries({ queryKey: ["my-numbers"] });
      setReleaseTarget(null);
    },
    onError: (err) =>
      toast.error(translateError(err, "Falha ao liberar número")),
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
        toast.error(translateError(res));
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
      toast.error(translateError(err, "Falha ao vincular atendente")),
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
      toast.error(translateError(err, "Falha ao remover atendente")),
  });




  const handleSignOut = async () => {
    const supabase = getSupabaseBrowser();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
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
            {isSipConnected && sipConn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    SIP: {sipConn.friendlyLabel || sipConn.sipUsername}
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
                    Desconectar tronco SIP
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
                    {numbersQuery.isLoading ? (
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
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-xs font-medium text-foreground">
                                {n.phone_number}
                              </p>
                              {(n.isTest || /gratuito/i.test(n.provider)) && (
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  Demo
                                </span>
                              )}

                            </div>
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
                                  onClick={() => resyncMutation.mutate(n.phone_number)}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Ressincronizar credenciais na Vapi
                                </DropdownMenuItem>

                                {n.vapiId ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      deleteVapiNumberMutation.mutate(n.vapiId!)
                                    }
                                    disabled={deleteVapiNumberMutation.isPending}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remover número da Vapi
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
                  Números seus, usados para testar ligações da assistente.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  disabled={testContactsQuery.isFetching}
                  onClick={() => testContactsQuery.refetch()}
                  title="Atualizar lista"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${testContactsQuery.isFetching ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setTestContactOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Novo contato
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {testContactsQuery.isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                  />
                ))
              ) : testContacts.length === 0 ? (
                <div className="space-y-2 py-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum contato de teste cadastrado.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Cadastre um número seu para receber a ligação da assistente.
                  </p>
                </div>
              ) : (
                testContacts.map((c) => {
                  const from = rowCallFrom[c.id] || numbers[0]?.phone_number || "";
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
                              Nenhum número de origem disponível.{" "}
                              <button
                                type="button"
                                className="underline underline-offset-2 hover:text-foreground"
                                onClick={() => {
                                  setOpen(true);
                                }}
                              >
                                {isSipConnected
                                  ? "Cadastrar número do tronco SIP"
                                  : "Conectar número"}
                              </button>{" "}
                              para poder disparar testes.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Número de origem
                            </Label>
                            <Select
                              value={from}
                              onValueChange={(v) =>
                                setRowCallFrom((prev) => ({ ...prev, [c.id]: v }))
                              }
                            >
                              <SelectTrigger className="h-9 border-white/[0.08] bg-background/40 backdrop-blur-xl">
                                <SelectValue placeholder="Selecione o número de origem" />
                              </SelectTrigger>
                              <SelectContent>
                                {numbers.map((n) => (
                                  <SelectItem key={n.id} value={n.phone_number}>
                                    <span className="font-mono">{n.phone_number}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {n.provider}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
                          title={
                            !from
                              ? "Selecione um número de origem"
                              : !assistantId
                                ? "Selecione uma assistente"
                                : "Disparar ligação de teste"
                          }
                          disabled={!from || !assistantId || callingContactId === c.id}
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
              Rota ativa (tronco SIP)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {!isSipConnected ? (
              <p className="text-xs text-muted-foreground">
                Nenhum tronco SIP conectado. É opcional: você pode usar números da
                sua própria conta Vapi ou conectar o tronco da sua operadora.
              </p>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {sipConn?.friendlyLabel || "Tronco SIP"}
                  </p>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                    ativo
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {sipConn?.sipUsername}@{sipConn?.sipHost}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {sipConn?.vapiCredentialId
                    ? "credencial Vapi vinculada"
                    : "credencial Vapi ainda não vinculada"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>






      <Dialog
        open={testContactOpen}
        onOpenChange={(o) => {
          setTestContactOpen(o);
          if (!o) setTestContactForm({ label: "", phoneE164: "" });
        }}
      >
        <DialogContent className="max-w-md border-white/[0.08] bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Novo contato de teste</DialogTitle>
            <DialogDescription>
              Cadastre um número seu para receber as ligações de teste da assistente.
              O tronco SIP disca direto, sem verificação por SMS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Identificação</Label>
              <Input
                placeholder="Ex: Meu celular"
                value={testContactForm.label}
                onChange={(e) =>
                  setTestContactForm((f) => ({ ...f, label: e.target.value }))
                }
                disabled={savingContact}
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
                disabled={savingContact}
              />
              <p className="text-[10px] text-muted-foreground">
                Inclua o código do país (+55 para Brasil).
              </p>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleSaveTestContact}
              disabled={savingContact}
            >
              {savingContact ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Salvar contato
            </Button>
          </div>
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

          <div className="space-y-4">
            <Alert className="border-primary/30 bg-primary/10 text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Informe os dados do seu tronco SIP (gateway, usuário e senha) e o número
                (DID) que a IA vai usar. Com isso criamos o tronco na Vapi e associamos o
                número automaticamente.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Nome da conexão (opcional)</Label>
                <Input
                  placeholder="Ex: Tronco principal"
                  value={sipForm.label}
                  onChange={(e) => setSipForm({ ...sipForm, label: e.target.value })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Gateway / Host SIP</Label>
                <Input
                  placeholder="ex: sip.suaoperadora.com.br"
                  value={sipForm.sipHost}
                  onChange={(e) => setSipForm({ ...sipForm, sipHost: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Usuário SIP</Label>
                  <Input
                    placeholder="ex: 1001"
                    value={sipForm.sipUsername}
                    onChange={(e) =>
                      setSipForm({ ...sipForm, sipUsername: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Senha SIP</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={sipForm.sipPassword}
                    onChange={(e) =>
                      setSipForm({ ...sipForm, sipPassword: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Número (DID) em E.164</Label>
                  <Input
                    placeholder="+551140028922"
                    value={sipForm.phoneNumber}
                    onChange={(e) =>
                      setSipForm({ ...sipForm, phoneNumber: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nome do número</Label>
                  <Input
                    placeholder="Ex: Comercial SP"
                    value={sipForm.friendlyName}
                    onChange={(e) =>
                      setSipForm({ ...sipForm, friendlyName: e.target.value })
                    }
                  />
                </div>
              </div>


              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <p className="text-[11px] text-muted-foreground">
                  Encaminhe o DID, no painel da sua operadora, para este SIP URI:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-black/30 px-2 py-1 font-mono text-xs">
                    {sipUri}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopySip}>
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConnectSipTrunk} disabled={connecting} className="gap-2">
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Conectar tronco SIP
              </Button>
            </div>
          </div>

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
            <AlertDialogTitle>Desconectar tronco SIP?</AlertDialogTitle>
            <AlertDialogDescription>
              As credenciais do seu tronco SIP serão removidas deste app.
              Os números continuam listados, mas as chamadas ficarão bloqueadas até
              você reconectar.
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

