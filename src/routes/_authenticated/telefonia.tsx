import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  disconnectTwilio,
  getTwilioConnection,
  listMyNumbers,
  listTestContacts,
  listTwilioNumbers,
  listTwilioTrunks,
  makeTestCall,
  releaseNumber,
  removeTestContact,
  saveTwilioCredentials,
  sendVerifyOtp,
} from "@/lib/twilio.functions";

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

  const listFn = useServerFn(listMyNumbers);
  const releaseFn = useServerFn(releaseNumber);
  const connectSipFn = useServerFn(connectExternalNumber);
  const saveCredsFn = useServerFn(saveTwilioCredentials);
  const getConnFn = useServerFn(getTwilioConnection);
  const disconnectFn = useServerFn(disconnectTwilio);
  const listTwilioNumbersFn = useServerFn(listTwilioNumbers);
  const listTwilioTrunksFn = useServerFn(listTwilioTrunks);
  const listTestContactsFn = useServerFn(listTestContacts);
  const removeTestContactFn = useServerFn(removeTestContact);
  const makeTestCallFn = useServerFn(makeTestCall);
  const sendOtpFn = useServerFn(sendVerifyOtp);
  const checkOtpFn = useServerFn(checkVerifyOtp);


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
        return {
          id: local?.id ?? n.sid,
          phone_number: n.phoneNumber,
          region: local?.region ?? null,
          provider: "Twilio (Sua conta)",
          assistant: local?.assistant ?? null,
          calls_today: local?.calls_today ?? 0,
          answer_rate: local?.answer_rate ?? 0,
          health: "Seguro" as Health,
        };
      })
    : localNumbers;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"twilio" | "sip">("twilio");
  const [releaseTarget, setReleaseTarget] = useState<NumberRow | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testContactOpen, setTestContactOpen] = useState(false);
  const [testContactForm, setTestContactForm] = useState({ label: "", phoneE164: "" });
  const [testCallFrom, setTestCallFrom] = useState<string>("");
  const [callingContactId, setCallingContactId] = useState<string | null>(null);
  // Two-step new-contact flow: "form" → "code"
  const [contactStep, setContactStep] = useState<"form" | "code">("form");
  const [otpCode, setOtpCode] = useState("");
  // Verify existing (already-saved) contact via SMS
  const [verifyExisting, setVerifyExisting] = useState<{
    id: string;
    label: string;
    phone: string;
  } | null>(null);
  const [verifyOtp, setVerifyOtp] = useState("");

  const testContactsQuery = useQuery({
    queryKey: ["test-contacts"],
    queryFn: () => listTestContactsFn(),
  });
  const testContacts = (testContactsQuery.data ?? []) as Array<{
    id: string;
    label: string;
    phone_e164: string;
    verified: boolean | null;
    created_at: string;
  }>;

  const sendOtpMutation = useMutation({
    mutationFn: (phoneE164: string) =>
      sendOtpFn({ data: { phoneE164, channel: "sms" } }),
    onSuccess: (res) => {
      if ("ok" in res && res.ok) {
        toast.success("Código enviado por SMS.");
      } else if ("reason" in res && res.reason === "no_credentials") {
        toast.error("Conecte sua conta Twilio primeiro.");
      } else if ("reason" in res && res.reason === "twilio_error") {
        toast.error(("message" in res && res.message) || "Falha ao enviar SMS.");
      }
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao enviar SMS"),
  });

  const checkOtpMutation = useMutation({
    mutationFn: (input: {
      phoneE164: string;
      code: string;
      contactId?: string;
      label?: string;
    }) => checkOtpFn({ data: input }),
    onSuccess: async (res) => {
      if ("ok" in res && res.ok) {
        toast.success("Número verificado!");
        await queryClient.invalidateQueries({ queryKey: ["test-contacts"] });
        setTestContactOpen(false);
        setTestContactForm({ label: "", phoneE164: "" });
        setContactStep("form");
        setOtpCode("");
        setVerifyExisting(null);
        setVerifyOtp("");
      } else if ("reason" in res && res.reason === "invalid_code") {
        toast.error("Código inválido. Confira o SMS e tente novamente.");
      } else if ("reason" in res && res.reason === "expired") {
        toast.error("Código expirado. Reenvie um novo SMS.");
      } else if ("reason" in res && res.reason === "no_credentials") {
        toast.error("Conecte sua conta Twilio primeiro.");
      } else if ("reason" in res && res.reason === "twilio_error") {
        toast.error(("message" in res && res.message) || "Falha na verificação.");
      }
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao verificar código"),
  });

  const removeTestContactMutation = useMutation({
    mutationFn: (id: string) => removeTestContactFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Contato removido.");
      await queryClient.invalidateQueries({ queryKey: ["test-contacts"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao remover contato"),
  });


  const testCallMutation = useMutation({
    mutationFn: (contact: { id: string; phone_e164: string }) => {
      setCallingContactId(contact.id);
      return makeTestCallFn({
        data: { fromNumber: testCallFrom, toNumber: contact.phone_e164 },
      });
    },
    onSuccess: (res) => {
      if ("ok" in res && res.ok) {
        toast.success("Chamada iniciada. Aguarde o telefone tocar.");
      } else if ("reason" in res && res.reason === "no_credentials") {
        toast.error("Conecte sua conta Twilio antes de testar.");
      } else if ("reason" in res && res.reason === "unverified_number") {
        toast.error(res.message ?? "Número não verificado no Twilio (trial).");
      }
    },
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

  const resetModal = () => {
    setTab("twilio");
    setTwilioForm({ accountSid: "", authToken: "" });
    setSipForm({ routeName: "" });
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
                            {n.assistant ?? "—"}
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Rotas ativas (Twilio Trunks)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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

        <Card className="border-white/[0.08] bg-card/20 backdrop-blur-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Contatos de teste</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre números pessoais e teste uma chamada saindo do seu número Twilio.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setTestContactOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Novo contato
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isTwilioConnected && (
              <Alert className="border-warning/30 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Conecte sua conta Twilio para poder disparar chamadas de teste. Em contas
                  trial, o número de destino também precisa estar verificado em <b>Console
                  Twilio → Verified Caller IDs</b>.
                </AlertDescription>
              </Alert>
            )}

            {numbers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">Ligar a partir de:</Label>
                <select
                  value={testCallFrom || numbers[0]?.phone_number || ""}
                  onChange={(e) => setTestCallFrom(e.target.value)}
                  className="h-8 rounded-md border border-white/[0.08] bg-background/60 px-2 text-xs text-foreground"
                >
                  {numbers.map((n) => (
                    <option key={n.id} value={n.phone_number}>
                      {n.phone_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {testContactsQuery.isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
                />
              ))
            ) : testContacts.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum contato de teste ainda. Clique em <b>Novo contato</b> para começar.
              </p>
            ) : (
              testContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.label}
                      </p>
                      {c.verified ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          Verificado
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          Não verificado
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {c.phone_e164}
                    </p>
                  </div>
                  {!c.verified && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isTwilioConnected || sendOtpMutation.isPending}
                      onClick={() => {
                        setVerifyExisting({
                          id: c.id,
                          label: c.label,
                          phone: c.phone_e164,
                        });
                        setVerifyOtp("");
                        sendOtpMutation.mutate(c.phone_e164);
                      }}
                      className="gap-1.5"
                    >
                      {sendOtpMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Verificar via SMS
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !isTwilioConnected ||
                      numbers.length === 0 ||
                      callingContactId === c.id ||
                      !c.verified
                    }
                    onClick={() =>
                      testCallMutation.mutate({ id: c.id, phone_e164: c.phone_e164 })
                    }
                    className="gap-1.5"
                  >
                    {callingContactId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PhoneCall className="h-3.5 w-3.5" />
                    )}
                    Testar chamada
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeTestContactMutation.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
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
            setContactStep("form");
            setOtpCode("");
          }
        }}
      >
        <DialogContent className="max-w-md border-white/[0.08] bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>
              {contactStep === "form" ? "Novo contato de teste" : "Confirme o código"}
            </DialogTitle>
            <DialogDescription>
              {contactStep === "form"
                ? "Cadastre um número que receberá as chamadas de teste. Formato E.164 (ex: +5511999998888)."
                : `Enviamos um SMS com um código de 6 dígitos para ${testContactForm.phoneE164}. Digite-o abaixo para concluir o cadastro.`}
            </DialogDescription>
          </DialogHeader>

          {contactStep === "form" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tc-label" className="text-xs">Identificação</Label>
                <Input
                  id="tc-label"
                  placeholder="Ex: Meu celular"
                  value={testContactForm.label}
                  onChange={(e) =>
                    setTestContactForm((f) => ({ ...f, label: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tc-phone" className="text-xs">Número (E.164)</Label>
                <Input
                  id="tc-phone"
                  placeholder="+5511999998888"
                  value={testContactForm.phoneE164}
                  onChange={(e) =>
                    setTestContactForm((f) => ({ ...f, phoneE164: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setTestContactOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    const phone = testContactForm.phoneE164.trim();
                    const res = await sendOtpMutation.mutateAsync(phone);
                    if ("ok" in res && res.ok) {
                      setContactStep("code");
                      setOtpCode("");
                    }
                  }}
                  disabled={
                    sendOtpMutation.isPending ||
                    !testContactForm.label.trim() ||
                    !testContactForm.phoneE164.trim() ||
                    !isTwilioConnected
                  }
                >
                  {sendOtpMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Próximo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tc-otp" className="text-xs">Código SMS</Label>
                <Input
                  id="tc-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={10}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center font-mono text-2xl tracking-[0.4em]"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() =>
                    sendOtpMutation.mutate(testContactForm.phoneE164.trim())
                  }
                  disabled={sendOtpMutation.isPending}
                >
                  Reenviar código
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setContactStep("form")}
                >
                  ← Voltar
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setTestContactOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    checkOtpMutation.mutate({
                      phoneE164: testContactForm.phoneE164.trim(),
                      code: otpCode.trim(),
                      label: testContactForm.label.trim(),
                    })
                  }
                  disabled={checkOtpMutation.isPending || otpCode.trim().length < 4}
                >
                  {checkOtpMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmar e salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={verifyExisting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setVerifyExisting(null);
            setVerifyOtp("");
          }
        }}
      >
        <DialogContent className="max-w-md border-white/[0.08] bg-card/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Verificar número</DialogTitle>
            <DialogDescription>
              Enviamos um SMS com o código para <b>{verifyExisting?.phone}</b>. Digite-o
              abaixo para verificar este contato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={10}
              value={verifyOtp}
              onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-2xl tracking-[0.4em]"
            />
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() =>
                  verifyExisting && sendOtpMutation.mutate(verifyExisting.phone)
                }
                disabled={sendOtpMutation.isPending}
              >
                Reenviar código
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setVerifyExisting(null)}>
                Fechar
              </Button>
              <Button
                onClick={() =>
                  verifyExisting &&
                  checkOtpMutation.mutate({
                    phoneE164: verifyExisting.phone,
                    code: verifyOtp.trim(),
                    contactId: verifyExisting.id,
                  })
                }
                disabled={checkOtpMutation.isPending || verifyOtp.trim().length < 4}
              >
                {checkOtpMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirmar
              </Button>
            </div>
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

          <Tabs value={tab} onValueChange={(v) => setTab(v as "twilio" | "sip")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="twilio">Twilio</TabsTrigger>
              <TabsTrigger value="sip">SIP Trunk</TabsTrigger>
            </TabsList>

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
    </DashboardShell>


  );
}
