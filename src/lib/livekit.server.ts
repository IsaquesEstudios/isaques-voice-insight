// Helpers server-only para a integração LiveKit.
// Nunca importar em código de cliente — as credenciais ficam no servidor.
import { SignJWT } from "jose";

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
    ? { roomCreate: true, roomAdmin: true, roomList: true }
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
        // Encerra a sala 5 min após ficar vazia, para não acumular custo.
        empty_timeout: 300,
        max_participants: 4,
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
