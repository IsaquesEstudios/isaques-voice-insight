import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteWhatsappAiAgent, getGeminiCredentialStatus, listWhatsappAiAgents, saveWhatsappAiAgent } from "@/lib/whatsapp-ai.functions";
import { listarNumerosWhatsapp } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp-assistentes")({
  head: () => ({
    meta: [
      { title: "Assistente de IA para WhatsApp — Omniasyn" },
      { name: "description", content: "Crie assistentes de IA para atender seus números de WhatsApp." },
      { property: "og:title", content: "Assistente de IA para WhatsApp — Omniasyn" },
      { property: "og:description", content: "Configure identidade, estilo e conhecimento dos seus atendentes de WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsappAssistentesPage,
});

type Agent = Awaited<ReturnType<typeof listWhatsappAiAgents>>[number];
type FormState = {
  id: string | null;
  name: string;
  area: "suporte" | "vendas" | "educacao";
  mission: string;
  tone: "acolhedor" | "formal" | "descontraido" | "tecnico";
  emojiUsage: "nunca" | "raramente" | "frequente";
  responseLength: "curtas" | "medias" | "detalhadas";
  restrictions: string;
  knowledge: string;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  area: "suporte",
  mission: "",
  tone: "acolhedor",
  emojiUsage: "raramente",
  responseLength: "medias",
  restrictions: "",
  knowledge: "",
};

function agentToForm(agent: Agent): FormState {
  return {
    id: agent.id,
    name: agent.name,
    area: agent.area as FormState["area"],
    mission: agent.mission,
    tone: agent.tone as FormState["tone"],
    emojiUsage: agent.emoji_usage as FormState["emojiUsage"],
    responseLength: agent.response_length as FormState["responseLength"],
    restrictions: agent.restrictions,
    knowledge: agent.knowledge,
  };
}

function WhatsappAssistentesPage() {
  const queryClient = useQueryClient();
  const listAgents = useServerFn(listWhatsappAiAgents);
  const listNumbers = useServerFn(listarNumerosWhatsapp);
  const saveAgent = useServerFn(saveWhatsappAiAgent);
  const removeAgent = useServerFn(deleteWhatsappAiAgent);
  const getCredentialStatus = useServerFn(getGeminiCredentialStatus);
  const [form, setForm] = useState<FormState | null>(null);

  const agents = useQuery({ queryKey: ["whatsapp-ai-agents"], queryFn: () => listAgents() });
  const geminiStatus = useQuery({ queryKey: ["gemini-credential-status"], queryFn: () => getCredentialStatus() });
  const numbers = useQuery({ queryKey: ["whatsapp-numeros"], queryFn: () => listNumbers() });
  const save = useMutation({
    mutationFn: (value: FormState) => saveAgent({ data: value }),
    onSuccess: () => {
      toast.success("Assistente salvo.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-ai-agents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeAgent({ data: { id } }),
    onSuccess: () => {
      toast.success("Assistente excluído.");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assistente de IA</h1>
            <p className="mt-1 text-sm text-muted-foreground">Crie a inteligência que atenderá seus clientes pelo WhatsApp.</p>
          </div>
          <Button onClick={() => setForm(emptyForm)}><Plus />Criar assistente</Button>
        </div>

        {agents.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 animate-spin" />Carregando...</div>
        ) : (agents.data ?? []).length === 0 ? (
          <Card className="border-border/60 bg-card/70">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-lg bg-primary/10 text-primary"><Bot /></div>
              <p className="font-semibold">Nenhum assistente criado</p>
              <p className="max-w-md text-sm text-muted-foreground">Crie seu primeiro assistente e depois vincule-o a um número de WhatsApp.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(agents.data ?? []).map((agent) => {
              const linked = (numbers.data ?? []).filter((number) => number.whatsapp_ai_agent_id === agent.id);
              return (
                <Card key={agent.id} className="border-border/60 bg-card/70">
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0"><CardTitle className="truncate text-base">{agent.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Gemini · {agent.area}</p></div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label="Editar assistente" onClick={() => setForm(agentToForm(agent))}><Pencil /></Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir assistente" disabled={remove.isPending} onClick={() => remove.mutate(agent.id)}><Trash2 /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{agent.mission}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{agent.tone}</Badge>
                      <Badge variant="secondary">respostas {agent.response_length}</Badge>
                    </div>
                    <div className="border-t border-border/60 pt-3">
                      <p className="text-xs font-medium text-foreground">{linked.length} número(s) vinculado(s)</p>
                      {linked.map((number) => <p key={number.id} className="mt-1 truncate text-xs text-muted-foreground">{number.display_phone_number ?? number.verified_name}</p>)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Editar assistente" : "Criar assistente"}</DialogTitle><DialogDescription>Defina como o assistente deve se apresentar, responder e agir.</DialogDescription></DialogHeader>
          {form ? <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome"><Input value={form.name} placeholder="Luna" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="IA utilizada">
                <Input value="Gemini" disabled />
                {geminiStatus.data && !geminiStatus.data.configured ? (
                  <p className="text-sm font-medium text-destructive">
                    A chave da API do Gemini não está configurada. Preencha em Configurações → API e chaves antes de salvar o assistente.
                  </p>
                ) : null}
              </Field>
              <Field label="Área"><AgentSelect value={form.area} onValueChange={(area) => setForm({ ...form, area: area as FormState["area"] })} options={[['suporte','Suporte'],['vendas','Vendas'],['educacao','Educação']]} /></Field>
              <Field label="Tom"><AgentSelect value={form.tone} onValueChange={(tone) => setForm({ ...form, tone: tone as FormState["tone"] })} options={[['acolhedor','Acolhedor'],['formal','Formal'],['descontraido','Descontraído'],['tecnico','Técnico']]} /></Field>
              <Field label="Emojis"><AgentSelect value={form.emojiUsage} onValueChange={(emojiUsage) => setForm({ ...form, emojiUsage: emojiUsage as FormState["emojiUsage"] })} options={[['nunca','Nunca'],['raramente','Raramente'],['frequente','Com frequência']]} /></Field>
              <Field label="Tamanho das respostas"><AgentSelect value={form.responseLength} onValueChange={(responseLength) => setForm({ ...form, responseLength: responseLength as FormState["responseLength"] })} options={[['curtas','Curtas'],['medias','Médias'],['detalhadas','Detalhadas']]} /></Field>
            </div>
            <Field label="Missão"><Textarea rows={2} value={form.mission} placeholder="Ajudar clientes a escolher o produto ideal." onChange={(e) => setForm({ ...form, mission: e.target.value })} /></Field>
            <Field label="Não deve"><Textarea rows={3} value={form.restrictions} placeholder="Prometer descontos, pedir dados sensíveis..." onChange={(e) => setForm({ ...form, restrictions: e.target.value })} /></Field>
            <Field label="Inteligência"><Textarea rows={8} value={form.knowledge} placeholder="Produtos, políticas, respostas frequentes e tudo que a IA precisa saber." onChange={(e) => setForm({ ...form, knowledge: e.target.value })} /></Field>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button disabled={!form || save.isPending} onClick={() => form && save.mutate(form)}>{save.isPending ? <Loader2 className="animate-spin" /> : null}Salvar assistente</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function AgentSelect({ value, onValueChange, options }: { value: string; onValueChange: (value: string) => void; options: [string, string][] }) {
  return <Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([itemValue, label]) => <SelectItem key={itemValue} value={itemValue}>{label}</SelectItem>)}</SelectContent></Select>;
}