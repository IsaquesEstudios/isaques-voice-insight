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
  connectExternalNumber,
  disconnectTwilio,
  getTwilioConnection,
  listMyNumbers,
  releaseNumber,
  saveTwilioCredentials,
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

const routes = [
  { name: "Rota Comercial SP", numbers: 8, load: 74, status: "Ativo" },
  { name: "Rota Cobrança Nacional", numbers: 12, load: 58, status: "Ativo" },
  { name: "Rota Recepção 24/7", numbers: 4, load: 92, status: "Ativo" },
  { name: "Rota Sandbox", numbers: 2, load: 12, status: "Pausado" },
];

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

  const numbers = (numbersQuery.data ?? []) as NumberRow[];
  const twilioConn = twilioConnQuery.data;
  const isTwilioConnected = twilioConn?.connected === true;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"twilio" | "sip">("twilio");
  const [releaseTarget, setReleaseTarget] = useState<NumberRow | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
              variant="outline"
              className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
            <Button variant="outline" className="gap-2 border-white/[0.08] bg-card/20 backdrop-blur-xl">
              <Globe2 className="h-4 w-4" /> Nova Rota
            </Button>
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
              <CardTitle className="text-base font-semibold">Rotas ativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {routes.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-xl transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{r.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "Ativo"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.numbers} números vinculados
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          r.load > 85 ? "bg-destructive" : r.load > 60 ? "bg-chart-3" : "bg-primary",
                        )}
                        style={{ width: `${r.load}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{r.load}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

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
    </DashboardShell>

  );
}
