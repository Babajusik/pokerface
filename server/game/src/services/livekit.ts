import { AccessToken } from "livekit-server-sdk";

// Генерация токенов доступа в LiveKit. Секрет живёт только на сервере.
// Ключи берутся из переменных окружения (server/game/.env).

export function hasLiveKit(): boolean {
  return !!(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );
}

export function liveKitUrl(): string {
  return process.env.LIVEKIT_URL || "";
}

// identity = Colyseus sessionId игрока (так видео-дорожки мапятся на игроков).
export async function createToken(room: string, identity: string, name: string): Promise<string> {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity,
    name,
    ttl: "2h",
  });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  return await at.toJwt();
}
