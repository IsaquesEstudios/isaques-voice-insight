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

// ---------------------------------------------------------------------------
// Reuniões em vídeo (LiveKit): criação de sala, entrada por código, acesso de
// convidado via link público e botão "Chamar IA" sob demanda.
// ---------------------------------------------------------------------------

export interface LivekitMeetingSession {
  token: string;
  serverUrl: string;
  roomName: string;
}

type MeetingCreatePayload = { meetingName: string; displayName?: string };
type MeetingJoinPayload = { code: string; displayName?: string };

function parseMeetingCreate(data: unknown): MeetingCreatePayload {
  const d = (data ?? {}) as Record<string, unknown>;
  const meetingName = typeof d.meetingName === "string" ? d.meetingName.trim() : "";
  if (!meetingName) throw new Error("Informe um nome para a reunião.");
  if (meetingName.length > 60) throw new Error("Nome muito longo (máx. 60 caracteres).");
  const displayName =
    typeof d.displayName === "string" && d.displayName.trim()
      ? d.displayName.trim().slice(0, 60)
      : undefined;
  return { meetingName, displayName };
}

function parseMeetingJoin(data: unknown, requireName: boolean): MeetingJoinPayload {
  const d = (data ?? {}) as Record<string, unknown>;
  const code = typeof d.code === "string" ? d.code.trim().toLowerCase() : "";
  if (!/^reuniao-[a-z0-9-]{3,70}$/.test(code)) {
    throw new Error("Código de reunião inválido.");
  }
  const displayName =
    typeof d.displayName === "string" && d.displayName.trim()
      ? d.displayName.trim().slice(0, 60)
      : undefined;
  if (requireName && !displayName) {
    throw new Error("Informe seu nome para entrar na reunião.");
  }
  return { code, displayName };
}

function parseMeetingCode(data: unknown): { code: string } {
  const { code } = parseMeetingJoin(data, false);
  return { code };
}

/** Cria a sala de reunião e devolve o token do organizador (painel). */
export const startLivekitMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMeetingCreate)
  .handler(async ({ data, context }): Promise<LivekitMeetingSession> => {
    const { createLivekitRoom, getLivekitEnv, signLivekitJwt, slugifyMeetingName } =
      await import("./livekit.server");
    const env = getLivekitEnv();

    const roomName = `reuniao-${slugifyMeetingName(data.meetingName)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const metadata = JSON.stringify({
      tipo: "reuniao",
      nome: data.meetingName,
      criadoPor: context.userId,
    });

    try {
      await createLivekitRoom(env, roomName, metadata, {
        emptyTimeout: 3600, // sala vazia sobrevive 1h (convidado pode chegar antes)
        departureTimeout: 600, // se todos caírem, sala aguenta 10min (recarga/rede)
        maxParticipants: 20,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
      throw new Error(
        `Não consegui criar a sala de reunião.\nDetalhe técnico: ${detail}`,
      );
    }

    const token = await signLivekitJwt(env, {
      identity: `painel-${context.userId.slice(0, 8)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      displayName: data.displayName ?? "Organizador",
      room: roomName,
      // Papel do participante: só o organizador controla a apresentação.
      metadata: JSON.stringify({ role: "host" }),
      ttlSeconds: 14400, // 4h — reuniões duram mais que chamadas de teste
    });

    return { token, serverUrl: env.url, roomName };
  });

/** Usuário logado entra em uma sala existente pelo código. */
export const joinLivekitMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseMeetingJoin(data, false))
  .handler(async ({ data, context }): Promise<LivekitMeetingSession> => {
    const { getLivekitEnv, livekitRoomExists, signLivekitJwt } = await import(
      "./livekit.server"
    );
    const env = getLivekitEnv();

    if (!(await livekitRoomExists(env, data.code))) {
      throw new Error(
        "Reunião não encontrada ou já encerrada. Confira o código ou peça um novo link ao organizador.",
      );
    }

    const token = await signLivekitJwt(env, {
      identity: `painel-${context.userId.slice(0, 8)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      displayName: data.displayName ?? "Participante",
      room: data.code,
      metadata: JSON.stringify({ role: "guest" }),
      ttlSeconds: 14400,
    });

    return { token, serverUrl: env.url, roomName: data.code };
  });

/**
 * Convidado externo entra pela rota pública /reuniao/<codigo>.
 * Sem autenticação: valida o padrão do código e confirma que a sala existe
 * antes de emitir o token — não expõe nada além do acesso àquela sala.
 */
export const joinLivekitMeetingAsGuest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseMeetingJoin(data, true))
  .handler(async ({ data }): Promise<LivekitMeetingSession> => {
    const { getLivekitEnv, livekitRoomExists, signLivekitJwt } = await import(
      "./livekit.server"
    );
    const env = getLivekitEnv();

    if (!(await livekitRoomExists(env, data.code))) {
      throw new Error(
        "Reunião não encontrada ou já encerrada. Confira o código ou peça um novo link ao organizador.",
      );
    }

    const token = await signLivekitJwt(env, {
      identity: `convidado-${Math.random().toString(36).slice(2, 10)}`,
      displayName: data.displayName ?? "Convidado",
      room: data.code,
      metadata: JSON.stringify({ role: "guest" }),
      ttlSeconds: 14400,
    });

    return { token, serverUrl: env.url, roomName: data.code };
  });

/**
 * Botão "Chamar IA": despacha o agente para a sala de reunião sob demanda.
 * Pública (convidados também podem chamar), mas exige código válido e sala ativa.
 */
export const callLivekitMeetingAgent = createServerFn({ method: "POST" })
  .inputValidator(parseMeetingCode)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { dispatchLivekitAgent, getLivekitEnv, livekitRoomExists } = await import(
      "./livekit.server"
    );
    const env = getLivekitEnv();

    if (!(await livekitRoomExists(env, data.code))) {
      throw new Error("Reunião não encontrada ou já encerrada.");
    }

    const metadata = JSON.stringify({ tipo: "reuniao", acao: "chamar_ia" });
    try {
      await dispatchLivekitAgent(env, data.code, metadata);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
      throw new Error(
        `Não consegui chamar a IA para a reunião.\nDetalhe técnico: ${detail}`,
      );
    }
    return { ok: true };
  });

/**
 * Controle de apresentação da reunião (quem aparece em destaque para todos).
 * Pública, mas exige o token LiveKit da própria sala como credencial:
 * - organizador (role host no token): define qualquer apresentador e gerencia
 *   a lista de participantes com permissão para apresentar;
 * - participante com permissão: só pode iniciar/encerrar a própria
 *   apresentação, sem alterar a lista de permissões.
 * Apenas um apresentador por vez: gravar um novo substitui o anterior.
 */
export const setMeetingPresenter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const code = typeof d.code === "string" ? d.code.trim().toLowerCase() : "";
    if (!/^reuniao-[a-z0-9-]{3,70}$/.test(code)) {
      throw new Error("Código de reunião inválido.");
    }
    const token = typeof d.token === "string" ? d.token : "";
    if (!token) throw new Error("Sessão da reunião inválida.");
    const presenter =
      d.presenter === null || d.presenter === undefined
        ? null
        : String(d.presenter).slice(0, 128);
    const allowed = Array.isArray(d.allowed)
      ? d.allowed.filter((x): x is string => typeof x === "string").slice(0, 20)
      : [];
    return { code, token, presenter, allowed };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getLivekitEnv, getLivekitRoomMetadata, updateLivekitRoomMetadata, verifyLivekitToken } =
      await import("./livekit.server");
    const env = getLivekitEnv();

    let caller: { identity: string; metadata?: string };
    try {
      caller = await verifyLivekitToken(env, data.token, data.code);
    } catch {
      throw new Error("Sessão da reunião expirada. Saia e entre novamente.");
    }

    const raw = await getLivekitRoomMetadata(env, data.code);
    if (raw === null) throw new Error("Reunião não encontrada ou já encerrada.");
    let base: Record<string, unknown> = {};
    try {
      base = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      base = {};
    }
    const currentAllowed = Array.isArray(base.allowed)
      ? (base.allowed as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

    let isHost = false;
    try {
      isHost = JSON.parse(caller.metadata ?? "{}").role === "host";
    } catch {
      isHost = false;
    }

    let next: Record<string, unknown>;
    if (isHost) {
      next = { ...base, presenter: data.presenter, allowed: data.allowed };
    } else {
      if (!currentAllowed.includes(caller.identity)) {
        throw new Error("O organizador ainda não liberou você para apresentar.");
      }
      if (data.presenter !== null && data.presenter !== caller.identity) {
        throw new Error("Você só pode iniciar ou encerrar a sua própria apresentação.");
      }
      // Participante permitido nunca altera a lista de permissões.
      next = { ...base, presenter: data.presenter };
    }

    try {
      await updateLivekitRoomMetadata(env, data.code, JSON.stringify(next));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
      throw new Error(
        `Não consegui atualizar a apresentação.\nDetalhe técnico: ${detail}`,
      );
    }
    return { ok: true };
  });

/**
 * Estado de apresentação da reunião (quem está em destaque + permissões).
 * Pública e sem dados sensíveis: usada como polling pelos participantes,
 * porque nem todo servidor LiveKit replica RoomUpdate para os clientes.
 */
export const getMeetingState = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const code = typeof d.code === "string" ? d.code.trim().toLowerCase() : "";
    if (!/^reuniao-[a-z0-9-]{3,70}$/.test(code)) {
      throw new Error("Código de reunião inválido.");
    }
    return { code };
  })
  .handler(async ({ data }): Promise<{ presenter: string | null; allowed: string[] }> => {
    const { getLivekitEnv, getLivekitRoomMetadata } = await import("./livekit.server");
    const raw = await getLivekitRoomMetadata(getLivekitEnv(), data.code);
    if (!raw) return { presenter: null, allowed: [] };
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      return {
        presenter: typeof j.presenter === "string" ? j.presenter : null,
        allowed: Array.isArray(j.allowed)
          ? j.allowed.filter((x): x is string => typeof x === "string")
          : [],
      };
    } catch {
      return { presenter: null, allowed: [] };
    }
  });

/**
 * Encerra a reunião para todos: apaga a sala no LiveKit, o que desconecta
 * imediatamente todos os participantes (motivo ROOM_DELETED no cliente).
 * Pública, mas exige o token LiveKit da sala com papel de organizador.
 */
export const endLivekitMeeting = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const code = typeof d.code === "string" ? d.code.trim().toLowerCase() : "";
    if (!/^reuniao-[a-z0-9-]{3,70}$/.test(code)) {
      throw new Error("Código de reunião inválido.");
    }
    const token = typeof d.token === "string" ? d.token : "";
    if (!token) throw new Error("Sessão da reunião inválida.");
    return { code, token };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteLivekitRoom, getLivekitEnv, verifyLivekitToken } = await import(
      "./livekit.server"
    );
    const env = getLivekitEnv();

    let caller: { identity: string; metadata?: string };
    try {
      caller = await verifyLivekitToken(env, data.token, data.code);
    } catch {
      throw new Error("Sessão da reunião expirada. Saia e entre novamente.");
    }

    let isHost = false;
    try {
      isHost = JSON.parse(caller.metadata ?? "{}").role === "host";
    } catch {
      isHost = false;
    }
    if (!isHost) {
      throw new Error("Somente o organizador pode encerrar a reunião para todos.");
    }

    try {
      await deleteLivekitRoom(env, data.code);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
      throw new Error(
        `Não consegui encerrar a reunião.\nDetalhe técnico: ${detail}`,
      );
    }
    return { ok: true };
  });
