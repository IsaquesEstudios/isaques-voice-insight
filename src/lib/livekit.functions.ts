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
  /** Quando true, a sala está com a transcrição (Deepgram) ativada. */
  transcribe?: boolean;
}

type MeetingCreatePayload = {
  meetingName: string;
  displayName?: string;
  scheduledAt?: string;
  transcribe: boolean;
  withAgent: boolean;
};
type MeetingJoinPayload = { code: string; displayName?: string };

/** Resultado da criação: reunião instantânea (sessão pronta) ou agendada. */
export type StartMeetingResult =
  | ({ kind: "started" } & LivekitMeetingSession)
  | { kind: "scheduled"; code: string; scheduledAt: string };

function parseMeetingCreate(data: unknown): MeetingCreatePayload {
  const d = (data ?? {}) as Record<string, unknown>;
  const meetingName = typeof d.meetingName === "string" ? d.meetingName.trim() : "";
  if (!meetingName) throw new Error("Informe um nome para a reunião.");
  if (meetingName.length > 60) throw new Error("Nome muito longo (máx. 60 caracteres).");
  const displayName =
    typeof d.displayName === "string" && d.displayName.trim()
      ? d.displayName.trim().slice(0, 60)
      : undefined;
  let scheduledAt: string | undefined;
  if (typeof d.scheduledAt === "string" && d.scheduledAt.trim()) {
    const ts = new Date(d.scheduledAt);
    if (Number.isNaN(ts.getTime())) throw new Error("Data de agendamento inválida.");
    // Datas no passado (ou agora) viram reunião instantânea.
    if (ts.getTime() > Date.now() + 60_000) scheduledAt = ts.toISOString();
  }
  // A IA precisa ouvir a conversa para responder: ativar a IA liga a
  // transcrição automaticamente (mesma regra da tela de criação).
  const withAgent = d.withAgent === true;
  const transcribe = d.transcribe === true || withAgent;
  const payload: MeetingCreatePayload = { meetingName, transcribe, withAgent };
  if (displayName) payload.displayName = displayName;
  if (scheduledAt) payload.scheduledAt = scheduledAt;
  return payload;
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

/**
 * Cria a reunião: instantânea (sala LiveKit criada na hora) ou agendada
 * (registrada no histórico para iniciar depois). Quando a sala já começa,
 * devolve a sessão do organizador (painel).
 */
export const startLivekitMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMeetingCreate)
  .handler(async ({ data, context }): Promise<StartMeetingResult> => {
    const {
      createLivekitRoom,
      dispatchLivekitAgent,
      getLivekitEnv,
      signLivekitJwt,
      slugifyMeetingName,
    } = await import("./livekit.server");

    const roomName = `reuniao-${slugifyMeetingName(data.meetingName)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    // Reunião agendada: só registra no histórico — a sala é criada no início.
    if (data.scheduledAt) {
      const { error } = await context.supabase.from("meeting_rooms").insert({
        user_id: context.userId,
        code: roomName,
        name: data.meetingName,
        scheduled_at: data.scheduledAt,
        transcrever: data.transcribe,
        assistente_ativa: data.withAgent,
      });
      if (error) throw new Error(`Falha ao agendar a reunião: ${error.message}`);
      return { kind: "scheduled", code: roomName, scheduledAt: data.scheduledAt };
    }

    const env = getLivekitEnv();
    // O worker Python lê a metadata da sala para decidir o comportamento:
    // transcrever=true → liga o Deepgram e grava a ata; acao=chamar_ia → a IA fala.
    const metadata = JSON.stringify({
      tipo: "reuniao",
      nome: data.meetingName,
      criadoPor: context.userId,
      transcrever: data.transcribe,
      assistente: data.withAgent,
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

    // Registra no histórico do usuário.
    await context.supabase.from("meeting_rooms").insert({
      user_id: context.userId,
      code: roomName,
      name: data.meetingName,
      started_at: new Date().toISOString(),
      transcrever: data.transcribe,
      assistente_ativa: data.withAgent,
    });

    // Com transcrição/IA pedidas na criação, o worker entra assim que a sala abre:
    // acao=chamar_ia (IA completa) ou acao=transcrever (só escuta e grava a ata).
    // IMPORTANTE: worker sem agent_name usa dispatch automático e já entra sozinho.
    // Um dispatch explícito nesse caso criaria uma SEGUNDA instância da IA na sala.
    if ((data.withAgent || data.transcribe) && env.agentName) {
      try {
        await dispatchLivekitAgent(
          env,
          roomName,
          JSON.stringify({
            tipo: "reuniao",
            acao: data.withAgent ? "chamar_ia" : "transcrever",
          }),
        );
      } catch (e) {
        console.error("Dispatch inicial da reunião falhou:", e);
      }
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

    return {
      kind: "started",
      token,
      serverUrl: env.url,
      roomName,
      transcribe: data.transcribe,
    };
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
 * Botão "Chamar IA": despacha o agente para a sala de reunião sob demanda.
 * Pública (convidados também podem chamar), mas exige código válido e sala ativa.
 */
export const callLivekitMeetingAgent = createServerFn({ method: "POST" })
  .inputValidator(parseMeetingCode)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const {
      dispatchLivekitAgent,
      getLivekitEnv,
      listLivekitParticipants,
      livekitRoomExists,
    } = await import("./livekit.server");
    const env = getLivekitEnv();

    if (!(await livekitRoomExists(env, data.code))) {
      throw new Error("Reunião não encontrada ou já encerrada.");
    }

    // Já existe um agente na sala? Não despacha de novo (evita IA duplicada).
    try {
      const participants = await listLivekitParticipants(env, data.code);
      if (participants.some((p) => String(p.kind ?? "").toUpperCase() === "AGENT"))
        return { ok: true };
    } catch {
      // Sem lista de participantes: segue com o dispatch.
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
 * Botão "Dispensar IA": remove o agente da sala (a reunião continua sem ele).
 * Exige o token LiveKit da sala com papel de organizador — convidados não
 * podem expulsar a IA. A transcrição/gravação da ata é finalizada pelo worker
 * ao ser desconectado.
 */
export const dismissLivekitMeetingAgent = createServerFn({ method: "POST" })
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
    const {
      getLivekitEnv,
      listLivekitParticipants,
      removeLivekitParticipant,
      verifyLivekitToken,
    } = await import("./livekit.server");
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
      throw new Error("Somente o organizador pode dispensar a IA da reunião.");
    }

    const participants = await listLivekitParticipants(env, data.code);
    const agent = participants.find(
      (p) => String(p.kind ?? "").toUpperCase() === "AGENT",
    );
    // A IA já saiu (ou nunca entrou): trata como sucesso para a UI sincronizar.
    if (!agent) return { ok: true };

    try {
      await removeLivekitParticipant(env, data.code, agent.identity);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
      throw new Error(`Não consegui dispensar a IA.\nDetalhe técnico: ${detail}`);
    }
    return { ok: true };
  });

/**
 * Transcrição (ata) de uma reunião, gravada pelo worker de IA via Deepgram.
 * Somente o organizador lê — a RLS da tabela restringe ao dono da reunião.
 */
export const getMeetingTranscript = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMeetingCode)
  .handler(async ({ data, context }): Promise<{ conteudo: string; criadoEm: string } | null> => {
    // Só o dono da reunião pode ler a ata (RLS de meeting_rooms garante isso).
    const { data: meeting } = await context.supabase
      .from("meeting_rooms")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();
    if (!meeting) throw new Error("Reunião não encontrada.");

    // O worker grava a ata pelo backend (sem user_id garantido), então a
    // leitura é feita após a checagem de posse acima.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("transcricoes_reunioes")
      .select("conteudo, criado_em")
      .eq("nome_sala", data.code)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar a transcrição: ${error.message}`);
    if (!row || !row.conteudo.trim()) return null;
    return { conteudo: row.conteudo, criadoEm: row.criado_em };
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

    // Marca o fim no histórico (melhor esforço — salas antigas podem não estar gravadas).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("meeting_rooms")
        .update({ ended_at: new Date().toISOString() })
        .eq("code", data.code)
        .is("ended_at", null);
    } catch {
      /* histórico é complementar; a sala já foi encerrada */
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Histórico de reuniões + sala de espera com aprovação do organizador.
// ---------------------------------------------------------------------------

export type MeetingStatus = "live" | "scheduled" | "ready" | "ended";

export interface MeetingDTO {
  id: string;
  code: string;
  name: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  status: MeetingStatus;
  /** Preferências gravadas na criação da reunião. */
  transcribe: boolean;
  withAgent: boolean;
  /** True quando o worker já gravou a ata desta reunião. */
  hasTranscript: boolean;
}

/** Lista as reuniões do usuário com o status calculado ("ao vivo" = sala ativa no LiveKit). */
export const listMyMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeetingDTO[]> => {
    const { data: rows, error } = await context.supabase
      .from("meeting_rooms")
      .select(
        "id, code, name, scheduled_at, started_at, ended_at, created_at, transcrever, assistente_ativa",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(`Falha ao carregar reuniões: ${error.message}`);
    if (!rows || rows.length === 0) return [];

    const { getLivekitEnv, listLivekitRoomNames } = await import("./livekit.server");
    let active = new Set<string>();
    try {
      active = await listLivekitRoomNames(getLivekitEnv());
    } catch {
      active = new Set();
    }

    // Quais reuniões já têm ata gravada pelo worker (RLS limita às do usuário).
    const { data: transcripts } = await context.supabase
      .from("transcricoes_reunioes")
      .select("nome_sala")
      .in("nome_sala", rows.map((r) => r.code));
    const withTranscript = new Set((transcripts ?? []).map((t) => t.nome_sala));

    const now = Date.now();
    const staleIds: string[] = [];
    const meetings: MeetingDTO[] = rows.map((m) => {
      let status: MeetingStatus;
      if (m.ended_at) status = "ended";
      else if (active.has(m.code)) status = "live";
      else if (m.scheduled_at && new Date(m.scheduled_at).getTime() > now)
        status = "scheduled";
      else if (m.scheduled_at) status = "ready";
      else {
        // Reunião instantânea cuja sala já expirou: encerra no histórico.
        status = "ended";
        staleIds.push(m.id);
      }
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        scheduledAt: m.scheduled_at,
        startedAt: m.started_at,
        endedAt: m.ended_at,
        createdAt: m.created_at,
        status,
        transcribe: m.transcrever,
        withAgent: m.assistente_ativa,
        hasTranscript: withTranscript.has(m.code),
      };
    });

    if (staleIds.length > 0) {
      const endedAt = new Date().toISOString();
      await context.supabase
        .from("meeting_rooms")
        .update({ ended_at: endedAt })
        .in("id", staleIds);
      for (const m of meetings) {
        if (staleIds.includes(m.id)) m.endedAt = endedAt;
      }
    }
    return meetings;
  });

/**
 * Organizador entra (ou inicia) a própria reunião: cria a sala quando ela
 * ainda não está ativa (agendada/pronta) e devolve o token com papel de host.
 */
export const enterMeetingAsHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMeetingCode)
  .handler(async ({ data, context }): Promise<LivekitMeetingSession> => {
    const {
      createLivekitRoom,
      dispatchLivekitAgent,
      getLivekitEnv,
      livekitRoomExists,
      signLivekitJwt,
    } = await import("./livekit.server");
    const env = getLivekitEnv();

    const { data: meeting, error } = await context.supabase
      .from("meeting_rooms")
      .select("id, code, name, started_at, ended_at, transcrever, assistente_ativa")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(`Falha ao abrir a reunião: ${error.message}`);
    if (!meeting) throw new Error("Reunião não encontrada.");
    if (meeting.ended_at) {
      throw new Error("Esta reunião já foi encerrada. Crie uma nova reunião.");
    }

    if (!(await livekitRoomExists(env, meeting.code))) {
      const metadata = JSON.stringify({
        tipo: "reuniao",
        nome: meeting.name,
        criadoPor: context.userId,
        transcrever: meeting.transcrever,
        assistente: meeting.assistente_ativa,
      });
      try {
        await createLivekitRoom(env, meeting.code, metadata, {
          emptyTimeout: 3600,
          departureTimeout: 600,
          maxParticipants: 20,
        });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e ?? "erro sem detalhes");
        throw new Error(
          `Não consegui iniciar a sala da reunião.\nDetalhe técnico: ${detail}`,
        );
      }
      // Sala recém-iniciada: aplica as preferências gravadas no agendamento.
      // Não despacha em sala já ativa — o organizador pode ter dispensado a IA.
      // Worker sem agent_name entra sozinho (dispatch automático): despachar
      // explicitamente duplicaria a IA na sala.
      if ((meeting.assistente_ativa || meeting.transcrever) && env.agentName) {
        try {
          await dispatchLivekitAgent(
            env,
            meeting.code,
            JSON.stringify({
              tipo: "reuniao",
              acao: meeting.assistente_ativa ? "chamar_ia" : "transcrever",
            }),
          );
        } catch (e) {
          console.error("Dispatch inicial da reunião falhou:", e);
        }
      }
      if (!meeting.started_at) {
        await context.supabase
          .from("meeting_rooms")
          .update({ started_at: new Date().toISOString() })
          .eq("id", meeting.id);
      }
    }

    const token = await signLivekitJwt(env, {
      identity: `painel-${context.userId.slice(0, 8)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      displayName: "Organizador",
      room: meeting.code,
      metadata: JSON.stringify({ role: "host" }),
      ttlSeconds: 14400,
    });

    return {
      token,
      serverUrl: env.url,
      roomName: meeting.code,
      transcribe: meeting.transcrever,
    };
  });

/** Encerra uma reunião do histórico (apaga a sala no LiveKit e marca o fim). */
export const closeMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMeetingCode)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { deleteLivekitRoom, getLivekitEnv } = await import("./livekit.server");

    const { data: meeting, error } = await context.supabase
      .from("meeting_rooms")
      .select("id, ended_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(`Falha ao encerrar a reunião: ${error.message}`);
    if (!meeting) throw new Error("Reunião não encontrada.");

    try {
      await deleteLivekitRoom(getLivekitEnv(), data.code);
    } catch {
      // Sala já inexistente no LiveKit — apenas registra o encerramento.
    }
    if (!meeting.ended_at) {
      await context.supabase
        .from("meeting_rooms")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", meeting.id);
    }
    return { ok: true };
  });

export interface MeetingJoinRequestStart {
  requestId: string;
  meetingName: string;
}

/**
 * Sala de espera: o convidado (sem login) pede para entrar. O token da sala
 * NUNCA é emitido aqui — só depois da aprovação do organizador.
 */
export const requestMeetingJoin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parseMeetingJoin(data, true))
  .handler(async ({ data }): Promise<MeetingJoinRequestStart> => {
    const { getLivekitEnv, livekitRoomExists } = await import("./livekit.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const env = getLivekitEnv();

    const { data: infoRows } = await supabaseAdmin.rpc("get_guest_meeting_info", {
      p_code: data.code,
    });
    const info = infoRows?.[0];
    if (!info) {
      throw new Error(
        "Reunião não encontrada. Confira o código ou peça um novo link ao organizador.",
      );
    }
    if (info.ended_at) throw new Error("Esta reunião já foi encerrada.");

    if (!(await livekitRoomExists(env, data.code))) {
      if (info.scheduled_at && new Date(info.scheduled_at).getTime() > Date.now()) {
        const when = new Date(info.scheduled_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        });
        throw new Error(`A reunião ainda não começou. Agendada para ${when}.`);
      }
      throw new Error(
        "Reunião não encontrada ou já encerrada. Confira o código ou peça um novo link ao organizador.",
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("meeting_join_requests")
      .insert({ room_code: data.code, guest_name: data.displayName ?? "Convidado" })
      .select("id")
      .single();
    if (error || !row) throw new Error("Não foi possível enviar o pedido de entrada.");

    return { requestId: row.id, meetingName: info.name };
  });

export interface MeetingJoinStatusResult {
  status: "pending" | "approved" | "denied" | "expired";
  session?: LivekitMeetingSession;
}

/** Polling do convidado: devolve a sessão somente após aprovação do organizador. */
export const getMeetingJoinRequestStatus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const id = (data as Record<string, unknown> | null)?.requestId;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id.trim())) {
      throw new Error("Pedido de entrada inválido.");
    }
    return { requestId: id.trim() };
  })
  .handler(async ({ data }): Promise<MeetingJoinStatusResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_meeting_join_status", {
      p_id: data.requestId,
    });
    const row = rows?.[0];
    if (error || !row) return { status: "expired" };
    if (row.status === "approved" && row.token) {
      const { getLivekitEnv } = await import("./livekit.server");
      return {
        status: "approved",
        session: {
          token: row.token,
          serverUrl: getLivekitEnv().url,
          roomName: row.room_code,
        },
      };
    }
    if (row.status === "denied") return { status: "denied" };
    return { status: "pending" };
  });

export interface MeetingJoinRequestDTO {
  id: string;
  guestName: string;
  createdAt: string;
}

/** Pedidos pendentes da sala de espera (somente o organizador da reunião, via RLS). */
export const listMeetingJoinRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseMeetingCode)
  .handler(async ({ data, context }): Promise<MeetingJoinRequestDTO[]> => {
    const { data: rows, error } = await context.supabase
      .from("meeting_join_requests")
      .select("id, guest_name, created_at")
      .eq("room_code", data.code)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao carregar solicitações: ${error.message}`);
    return (rows ?? []).map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      createdAt: r.created_at,
    }));
  });

/** Organizador aprova (emite o token do convidado) ou recusa a entrada. */
export const respondMeetingJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const requestId = typeof d.requestId === "string" ? d.requestId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Pedido inválido.");
    return { requestId, approve: d.approve === true };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: req, error } = await context.supabase
      .from("meeting_join_requests")
      .select("id, room_code, guest_name, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao responder: ${error.message}`);
    if (!req) throw new Error("Pedido não encontrado.");
    if (req.status !== "pending") throw new Error("Este pedido já foi respondido.");

    if (!data.approve) {
      const { error: upErr } = await context.supabase
        .from("meeting_join_requests")
        .update({ status: "denied" })
        .eq("id", req.id);
      if (upErr) throw new Error(`Falha ao recusar a entrada: ${upErr.message}`);
      return { ok: true };
    }

    const { getLivekitEnv, signLivekitJwt } = await import("./livekit.server");
    const env = getLivekitEnv();
    const token = await signLivekitJwt(env, {
      identity: `convidado-${Math.random().toString(36).slice(2, 10)}`,
      displayName: req.guest_name,
      room: req.room_code,
      metadata: JSON.stringify({ role: "guest" }),
      ttlSeconds: 14400,
    });
    const { error: upErr } = await context.supabase
      .from("meeting_join_requests")
      .update({ status: "approved", token })
      .eq("id", req.id);
    if (upErr) throw new Error(`Falha ao aprovar a entrada: ${upErr.message}`);
    return { ok: true };
  });
