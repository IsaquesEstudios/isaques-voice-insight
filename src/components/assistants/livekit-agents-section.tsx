import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  PhoneCall,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listLivekitAgents,
  createLivekitAgent,
  updateLivekitAgent,
  deleteLivekitAgent,
  type LivekitAgentDTO,
} from "@/lib/livekit.functions";
import { translateError } from "@/lib/error-messages";
import { LivekitCallDialog } from "@/components/assistants/livekit-call-dialog";

function relativeFromNow(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)}d`;
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  editingId: string | null;
  name: string;
  perfil: string;
  contexto: string;
  voz: string;
}

const emptyForm: FormState = {
  open: false,
  mode: "create",
  editingId: null,
  name: "",
  perfil: "",
  contexto: "",
  voz: "",
};

/**
 * Seção "Agentes Omniasyn — LiveKit": alternativa própria à Vapi, com
 * identidade visual da marca (gradiente cyan → verde) e chamada de teste
 * direto no navegador via LiveKit.
 */
export function LivekitAgentsSection() {
  const queryClient = useQueryClient();
  const fetchAgents = useServerFn(listLivekitAgents);
  const createAgent = useServerFn(createLivekitAgent);
  const updateAgent = useServerFn(updateLivekitAgent);
  const deleteAgent = useServerFn(deleteLivekitAgent);

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["livekit-agents", "list"],
    queryFn: () => fetchAgents(),
    staleTime: 5 * 60_000,
  });
  const agents = agentsData ?? [];

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LivekitAgentDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testTarget, setTestTarget] = useState<LivekitAgentDTO | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["livekit-agents"] });
  };

  function openCreate() {
    setForm({ ...emptyForm, open: true, mode: "create" });
  }

  function openEdit(agent: LivekitAgentDTO) {
    setForm({
      open: true,
      mode: "edit",
      editingId: agent.id,
      name: agent.name,
      perfil: agent.perfil ?? "",
      contexto: agent.contexto ?? "",
      voz: agent.voz ?? "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe um nome para o agente.");
      return;
    }
    setIsSubmitting(true);
    const payload = {
      name: form.name,
      perfil: form.perfil,
      contexto: form.contexto,
      voz: form.voz,
    };
    try {
      if (form.mode === "create") {
        await createAgent({ data: payload });
        toast.success("Agente criado com sucesso.");
      } else if (form.editingId) {
        await updateAgent({ data: { id: form.editingId, ...payload } });
        toast.success("Agente atualizado.");
      }
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      toast.error(translateError(err, "Erro ao salvar agente."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAgent({ data: { id: deleteTarget.id } });
      toast.success("Agente excluído.");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(translateError(err, "Erro ao excluir agente."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="space-y-4">
      {/* Cabeçalho da seção com identidade Omniasyn */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-transparent to-chart-2/10 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-glow">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Agentes Omniasyn
              </h2>
              <span className="rounded-full bg-gradient-to-r from-primary to-chart-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                LiveKit
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Agentes de voz na nossa infraestrutura própria — sem depender da Vapi.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2 shadow-glow">
          <Plus className="h-4 w-4" />
          Novo Agente
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              className="relative overflow-hidden border-primary/20 bg-card/20 backdrop-blur-2xl"
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl bg-foreground/10" />
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-32 bg-foreground/10" />
                    <Skeleton className="h-3 w-20 bg-foreground/10" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full bg-foreground/10" />
                <Skeleton className="h-9 w-full rounded-md bg-foreground/10" />
              </CardContent>
            </Card>
          ))
        ) : agents.length === 0 ? (
          <Card className="col-span-full border-dashed border-primary/25 bg-gradient-to-br from-primary/5 to-chart-2/5 backdrop-blur-2xl">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Nenhum agente LiveKit ainda
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crie seu primeiro agente e teste a chamada direto no navegador.
                </p>
              </div>
              <Button onClick={openCreate} variant="outline" className="gap-2 border-primary/30">
                <Plus className="h-4 w-4" />
                Criar agente
              </Button>
            </CardContent>
          </Card>
        ) : (
          agents.map((agent) => (
            <Card
              key={agent.id}
              className="group relative overflow-hidden border-primary/20 bg-card/20 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 to-chart-2/10 opacity-60"
                aria-hidden
              />
              <CardContent className="relative space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-chart-2/25 text-primary backdrop-blur-xl">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.perfil?.trim() || "Sem perfil definido"}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-border bg-card/80 backdrop-blur-2xl"
                    >
                      <DropdownMenuItem onSelect={() => openEdit(agent)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setDeleteTarget(agent)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
                  {agent.contexto?.trim() || "Sem instruções configuradas."}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Atualizado {relativeFromNow(agent.updatedAt)}
                  </span>
                  {agent.voz?.trim() && (
                    <span className="rounded-full bg-chart-2/15 px-2 py-0.5 text-[10px] font-semibold text-chart-2">
                      Voz: {agent.voz}
                    </span>
                  )}
                </div>

                <Button
                  onClick={() => setTestTarget(agent)}
                  className="w-full gap-2 bg-gradient-to-r from-primary to-chart-2 text-primary-foreground shadow-glow hover:opacity-90"
                >
                  <PhoneCall className="h-4 w-4" />
                  Testar chamada
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={form.open}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setForm((f) => ({ ...f, open }));
        }}
      >
        <DialogContent className="max-w-lg border-border bg-card/80 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.mode === "create" ? "Novo Agente Omniasyn" : "Editar Agente"}
            </DialogTitle>
            <DialogDescription>
              Estes dados são enviados ao seu agente LiveKit (metadata da sala) no
              início de cada chamada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lk-name">Nome do agente</Label>
              <Input
                id="lk-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Ana • Recepção"
                required
                className="border-border bg-background/40 backdrop-blur-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lk-perfil">Perfil</Label>
              <Input
                id="lk-perfil"
                value={form.perfil}
                onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))}
                placeholder="Ex: recepcionista, SDR, suporte nível 1"
                className="border-border bg-background/40 backdrop-blur-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lk-voz">Voz</Label>
              <Input
                id="lk-voz"
                value={form.voz}
                onChange={(e) => setForm((f) => ({ ...f, voz: e.target.value }))}
                placeholder="Ex: voz feminina pt-BR (conforme seu worker)"
                className="border-border bg-background/40 backdrop-blur-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lk-contexto">Contexto / Instruções</Label>
              <Textarea
                id="lk-contexto"
                value={form.contexto}
                onChange={(e) => setForm((f) => ({ ...f, contexto: e.target.value }))}
                placeholder="Descreva o papel, tom e regras do agente. O worker LiveKit recebe este texto na metadata da sala."
                rows={6}
                className="border-border bg-background/40 backdrop-blur-xl"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm(emptyForm)}
                disabled={isSubmitting}
                className="border-border bg-card/20 backdrop-blur-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {form.mode === "create" ? "Criar Agente" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !isDeleting && !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="border-border bg-card/80 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O agente{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>{" "}
              será removido e não poderá ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir definitivamente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Teste de chamada no navegador */}
      {testTarget && (
        <LivekitCallDialog
          agentId={testTarget.id}
          agentName={testTarget.name}
          open={testTarget !== null}
          onOpenChange={(open) => {
            if (!open) setTestTarget(null);
          }}
        />
      )}
    </section>
  );
}
