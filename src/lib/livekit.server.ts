// Helpers server-only para a integração LiveKit.
// Nunca importar em código de cliente — as credenciais ficam no servidor.
import { SignJWT, jwtVerify } from "jose";

export interface LivekitEnv {
  /** URL websocket do projeto (wss://...). */
  url: string;
  apiKey: string;
  apiSecret: string;
  /** Opcional: nome do worker, quando registrado com agent_name no LiveKit. */
  agentName?: string;
}

export function getLivekitEnv(): LivekitEnv {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const agentName = process.env.LIVEKIT_AGENT_NAME?.trim();
  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      "LiveKit não configurado. Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET.",
    );
  }
  return {
    url: url.trim(),
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    ...(agentName ? { agentName } : {}),
  };
}

/** Converte a URL websocket (wss://) em HTTP (https://) para a API REST/Twirp. */
export function livekitHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:").replace(/\/$/, "");
}

interface TokenOptions {
  identity: string;
  displayName?: string;
  room: string;
  metadata?: string;
  /** Grants extras de serviço (ex: roomCreate para chamar a API de salas). */
  service?: boolean;
  ttlSeconds?: number;
}

/**
 * Gera o JWT de acesso do LiveKit (HS256, iss = API key).
 * Formato oficial: grants de vídeo em `video`, dados do participante em `metadata`.
 */
export async function signLivekitJwt(env: LivekitEnv, opts: TokenOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const video: Record<string, unknown> = opts.service
    ? { roomCreate: true, roomAdmin: true, roomList: true, room: opts.room }
    : { roomJoin: true, room: opts.room, canPublish: true, canSubscribe: true };

  const payload: Record<string, unknown> = { video };
  if (!opts.service) {
    payload.sub = opts.identity;
    if (opts.displayName) payload.name = opts.displayName;
    if (opts.metadata) payload.metadata = opts.metadata;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.apiKey)
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + (opts.ttlSeconds ?? 600))
    .sign(new TextEncoder().encode(env.apiSecret));
}

/**
 * Verifica um token de participante (assinatura + sala) e devolve a identidade.
 * Usado para autorizar ações privilegiadas dentro da reunião (ex: apresentar)
 * sem depender da sessão do painel — o próprio token do LiveKit é a credencial.
 */
export async function verifyLivekitToken(
  env: LivekitEnv,
  token: string,
  roomName: string,
): Promise<{ identity: string; metadata?: string }> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(env.apiSecret));
  const video = (payload as { video?: Record<string, unknown> }).video;
  if (!video || video.room !== roomName || video.roomJoin !== true) {
    throw new Error("Token não autorizado para esta sala.");
  }
  const identity = typeof payload.sub === "string" ? payload.sub : "";
  if (!identity) throw new Error("Token sem identidade de participante.");
  return {
    identity,
    ...(typeof payload.metadata === "string" ? { metadata: payload.metadata } : {}),
  };
}

/** Despacha explicitamente um worker de agente para a sala recém-criada. */
export async function dispatchLivekitAgent(
  env: LivekitEnv,
  roomName: string,
  metadata: string,
): Promise<void> {
  const serviceJwt = await signLivekitJwt(env, {
    identity: "omnia-dispatch",
    room: roomName,
    service: true,
    ttlSeconds: 120,
  });

  const res = await fetch(
    `${livekitHttpUrl(env.url)}/twirp/livekit.AgentDispatchService/CreateDispatch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: roomName,
        metadata,
        ...(env.agentName ? { agent_name: env.agentName } : {}),
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LiveKit AgentDispatch retornou ${res.status}: ${body || "sem detalhes"}`,
    );
  }
}

/**
 * Cria a sala via API Twirp do LiveKit já com a metadata do agente.
 * Esse fluxo mantém compatibilidade com workers que usam dispatch automático.
 */
export async function createLivekitRoom(
  env: LivekitEnv,
  roomName: string,
  metadata: string,
  opts?: { emptyTimeout?: number; maxParticipants?: number; departureTimeout?: number },
): Promise<void> {
  const serviceJwt = await signLivekitJwt(env, {
    identity: "omnia-server",
    room: roomName,
    service: true,
    ttlSeconds: 120,
  });
  const res = await fetch(
    `${livekitHttpUrl(env.url)}/twirp/livekit.RoomService/CreateRoom`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        metadata,
        // Encerra a sala após ficar vazia, para não acumular custo.
        empty_timeout: opts?.emptyTimeout ?? 300,
        max_participants: opts?.maxParticipants ?? 4,
        // Tempo que a sala sobrevive depois que o último participante sai
        // (padrão do LiveKit é ~20s, o que encerrava reuniões em recargas).
        ...(opts?.departureTimeout
          ? { departure_timeout: opts.departureTimeout }
          : {}),
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Sala duplicada não é erro fatal.
    if (/already exists/i.test(body)) return;
    throw new Error(`LiveKit CreateRoom retornou ${res.status}: ${body || "sem detalhes"}`);
  }
}

/** Verifica se uma sala existe e está ativa no projeto LiveKit. */
export async function livekitRoomExists(env: LivekitEnv, roomName: string): Promise<boolean> {
  const serviceJwt = await signLivekitJwt(env, {
    identity: "omnia-server",
    room: roomName,
    service: true,
    ttlSeconds: 60,
  });
  const res = await fetch(
    `${livekitHttpUrl(env.url)}/twirp/livekit.RoomService/ListRooms`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ names: [roomName] }),
    },
  );
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as
    | { rooms?: Array<{ name?: string; metadata?: string }> }
    | null;
  return !!body?.rooms?.some((r) => r.name === roomName);
}

/** Lê a metadata atual da sala (null quando a sala não existe). */
export async function getLivekitRoomMetadata(
  env: LivekitEnv,
  roomName: string,
): Promise<string | null> {
  const serviceJwt = await signLivekitJwt(env, {
    identity: "omnia-server",
    room: roomName,
    service: true,
    ttlSeconds: 60,
  });
  const res = await fetch(
    `${livekitHttpUrl(env.url)}/twirp/livekit.RoomService/ListRooms`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ names: [roomName] }),
    },
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { rooms?: Array<{ name?: string; metadata?: string }> }
    | null;
  const room = body?.rooms?.find((r) => r.name === roomName);
  if (!room) return null;
  return room.metadata ?? "";
}

/**
 * Atualiza a metadata da sala (replicada em tempo real para todos os
 * participantes via evento RoomMetadataChanged). Preservar o conteúdo
 * anterior fica a cargo do chamador.
 */
export async function updateLivekitRoomMetadata(
  env: LivekitEnv,
  roomName: string,
  metadata: string,
): Promise<void> {
  const serviceJwt = await signLivekitJwt(env, {
    identity: "omnia-server",
    room: roomName,
    service: true,
    ttlSeconds: 60,
  });
  const res = await fetch(
    `${livekitHttpUrl(env.url)}/twirp/livekit.RoomService/UpdateRoomMetadata`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: roomName, metadata }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `LiveKit UpdateRoomMetadata retornou ${res.status}: ${body || "sem detalhes"}`,
    );
  }
}

/** Slug seguro para nomear salas de reunião (minúsculas, sem acentos). */
export function slugifyMeetingName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "sala";
}
