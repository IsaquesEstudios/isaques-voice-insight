import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// DTOs (tipos apagados no build — seguros para o cliente)
// ---------------------------------------------------------------------------

export interface LivekitAgentDTO {
  id: string;
  name: string;
  perfil: string | null;
  contexto: string | null;
  voz: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LivekitCallSession {
  token: string;
  serverUrl: string;
  roomName: string;
}

// ---------------------------------------------------------------------------
// Validação de entrada (inline para manter este arquivo como wrapper fino)
// ---------------------------------------------------------------------------

type AgentPayload = { name: string; perfil?: string; contexto?: string; voz?: string };

function parseAgentPayload(data: unknown): AgentPayload {
  const d = (data ?? {}) as Record<string, unknown>;
  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (!name) throw new Error("Informe um nome para o agente.");
  if (name.length > 80) throw new Error("Nome muito longo (máx. 80 caracteres).");
  const clean = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
  return {
    name,
    perfil: clean(d.perfil, 200),
    contexto: clean(d.contexto, 8000),
    voz: clean(d.voz, 120),
  };
}

function parseId(data: unknown): string {
  const id = (data as Record<string, unknown> | null)?.id;
  if (typeof id !== "string" || !id.trim()) throw new Error("Agente inválido.");
  return id.trim();
}

// ---------------------------------------------------------------------------
// CRUD de agentes LiveKit (banco local, escopado por usuário via RLS)
// ---------------------------------------------------------------------------

export const listLivekitAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LivekitAgentDTO[]> => {
    const { data, error } = await context.supabase
      .from("livekit_agents")
      .select("id, name, perfil, contexto, voz, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Falha ao carregar agentes: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      perfil: (row.perfil as string | null) ?? null,
      contexto: (row.contexto as string | null) ?? null,
      voz: (row.voz as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  });

export const createLivekitAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseAgentPayload)
  .handler(async ({ data, context }): Promise<LivekitAgentDTO> => {
    const { data: row, error } = await context.supabase
      .from("livekit_agents")
      .insert({
        user_id: context.userId,
        name: data.name,
        perfil: data.perfil ?? null,
        contexto: data.contexto ?? null,
        voz: data.voz ?? null,
      })
      .select("id, name, perfil, contexto, voz, created_at, updated_at")
      .single();
    if (error) throw new Error(`Falha ao criar agente: ${error.message}`);
    return {
      id: row.id as string,
      name: row.name as string,
      perfil: (row.perfil as string | null) ?? null,
      contexto: (row.contexto as string | null) ?? null,
      voz: (row.voz as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });

export const updateLivekitAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const id = parseId((data as Record<string, unknown> | null)?.id
      ? { id: (data as Record<string, unknown>).id }
      : data);
    return { id, ...parseAgentPayload(data) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("livekit_agents")
      .update({
        name: data.name,
        perfil: data.perfil ?? null,
        contexto: data.contexto ?? null,
        voz: data.voz ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(`Falha ao atualizar agente: ${error.message}`);
    return { ok: true };
  });

export const deleteLivekitAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseId)
  .handler(async ({ data: id, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("livekit_agents")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Falha ao excluir agente: ${error.message}`);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Sessão de chamada: cria a sala com metadata do agente e devolve o token de
// acesso para o navegador conectar. A criação explícita da sala é necessária
// para acionar workers LiveKit em modo de dispatch automático.
// ---------------------------------------------------------------------------

export const startLivekitCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ({
    agentId: parseId(
      data != null && typeof data === "object" && "agentId" in data
        ? { id: (data as Record<string, unknown>).agentId }
        : data,
    ),
  }))
  .handler(async ({ data, context }): Promise<LivekitCallSession> => {
    const { createLivekitRoom, dispatchLivekitAgent, getLivekitEnv, signLivekitJwt } =
      await import("./livekit.server");
    const env = getLivekitEnv();

    const { data: agent, error } = await context.supabase
      .from("livekit_agents")
      .select("id, name, perfil, contexto, voz")
      .eq("id", data.agentId)
      .single();
    if (error || !agent) throw new Error("Agente não encontrado.");

    const roomName = `omnia-${String(agent.id).slice(0, 8)}-${Date.now().toString(36)}`;
    // Dados dinâmicos entregues ao agente worker na entrada da sala.
    const metadata = JSON.stringify({
      agentId: agent.id,
      nome: agent.name,
      perfil: agent.perfil ?? "",
      contexto: agent.contexto ?? "",
      voz: agent.voz ?? "",
    });

    const identity = `painel-${context.userId.slice(0, 8)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    try {
      await createLivekitRoom(env, roomName, metadata);
      // Workers sem agent_name usam dispatch automático ao entrar na sala.
      // O dispatch explícito só pode ser roteado para um worker nomeado.
      if (env.agentName) {
        await dispatchLivekitAgent(env, roomName, metadata);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
      throw new Error(
        [
          "Não consegui enviar o agente LiveKit para a sala de teste.",
          `Detalhe técnico: ${detail}`,
          "Verifique se o worker Python está rodando, conectado ao mesmo projeto LiveKit e, se ele usa nome de agente, configure LIVEKIT_AGENT_NAME.",
        ].join("\n"),
      );
    }

    const token = await signLivekitJwt(env, {
      identity,
      displayName: "Teste Painel",
      room: roomName,
      metadata,
    });

    return { token, serverUrl: env.url, roomName };
  });
