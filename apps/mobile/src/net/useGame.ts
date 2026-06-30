import { useCallback, useEffect, useRef, useState } from "react";
import { Client, Room } from "colyseus.js";
import { ClientMsg, ServerMsg, Phase, HostLevel } from "@pokerface/shared";
import { SERVER_ENDPOINT, TOKEN_BASE } from "./config";
import { t } from "../i18n";

export interface CreateOpts {
  lobbyName: string;
  isPrivate: boolean;
  maxPlayers: number;
  hostLevel: HostLevel;
}

export interface PlayerView {
  id: string;
  name: string;
  cards: number;
  eliminated: boolean;
  faceVisible: boolean;
  ready: boolean;
  connected: boolean;
  mediaReady: boolean;
  hidingWarn: boolean;
}

export interface GameSnapshot {
  phase: string;
  lobbyName: string;
  code: string;
  maxPlayers: number;
  hostId: string;
  winnerId: string;
  players: PlayerView[];
}

export type Status = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const EMPTY: GameSnapshot = { phase: Phase.Lobby, lobbyName: "", code: "", maxPlayers: 8, hostId: "", winnerId: "", players: [] };

// Превращаем ошибку подключения Colyseus в понятный игроку текст.
// Коды матчмейкинга Colyseus: 4210–4214 (нет хендлера/невалидно/нет комнаты/…).
function friendlyError(e: any): string {
  const code = e?.code;
  const msg = String(e?.message || "");
  // Заполненная или закрытая (игра уже идёт) комната → сервер не даёт место.
  if (code === 4212 || /seat|locked|full|reservation/i.test(msg)) {
    return t("err.full");
  }
  if (code === 4210 || code === 4211 || code === 4213) {
    return t("err.closed");
  }
  if (code === 4214) return t("err.expired");
  // Сеть/сервер недоступен.
  if (!code && /failed to fetch|network|timeout|websocket/i.test(msg)) {
    return t("err.noServer");
  }
  return msg || t("err.generic");
}

// Хук подключения к игровому серверу. Зеркалит состояние комнаты в React.
export function useGame() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY);
  const [mySessionId, setMySessionId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [taunt, setTaunt] = useState<{ text: string; ts: number }>({ text: "", ts: 0 });
  const [itemEffect, setItemEffect] = useState<{
    itemId: string; text?: string; sticker?: string; fromName: string; ts: number;
  }>({ itemId: "", fromName: "", ts: 0 });
  const roomRef = useRef<Room | null>(null);
  const clientRef = useRef<Client | null>(null);
  const intentionalRef = useRef(false);          // true = пользователь сам вышел
  const reconnectRef = useRef<(token: string) => void>(() => {});

  // Единый Colyseus-клиент (нужен для reconnect по токену).
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = new Client(SERVER_ENDPOINT);
    return clientRef.current;
  }, []);

  const syncFromRoom = useCallback((room: Room) => {
    const state: any = room.state;
    const players: PlayerView[] = [];
    state.players?.forEach((p: any) => {
      players.push({
        id: p.id,
        name: p.name,
        cards: p.cards,
        eliminated: p.eliminated,
        faceVisible: p.faceVisible,
        ready: p.ready,
        connected: p.connected ?? true,
        mediaReady: p.mediaReady ?? false,
        hidingWarn: p.hidingWarn ?? false,
      });
    });
    setSnapshot({
      phase: state.phase,
      lobbyName: state.lobbyName,
      code: state.code,
      maxPlayers: state.maxPlayers,
      hostId: state.hostId,
      winnerId: state.winnerId,
      players,
    });
  }, []);

  const attach = useCallback(
    (room: Room) => {
      roomRef.current = room;
      setMySessionId(room.sessionId);
      setRoomId(room.roomId);
      // DEV: хэндл для ручного теста обрыва из консоли:
      //   __pfRoom.connection.transport.ws.close()  — имитирует разрыв связи
      if (typeof window !== "undefined" && (globalThis as any).__DEV__) {
        (window as any).__pfRoom = room;
      }
      room.onStateChange(() => syncFromRoom(room));
      room.onMessage(ServerMsg.Taunt, (m: { text: string }) =>
        setTaunt({ text: m.text, ts: Date.now() })
      );
      room.onMessage(ServerMsg.ItemUsed, (m: any) => {
        if (m.targetId === room.sessionId)
          setItemEffect({ itemId: m.itemId, text: m.text, sticker: m.sticker, fromName: m.fromName, ts: Date.now() });
      });
      room.onLeave((code: number) => {
        roomRef.current = null;
        // code 1000 = нормальное закрытие (выход). Иначе — обрыв связи.
        if (code === 1000 || intentionalRef.current) {
          intentionalRef.current = false;
          setStatus("idle");
          setSnapshot(EMPTY);
          return;
        }
        reconnectRef.current(room.reconnectionToken);
      });
      room.onError((code, message) => setError(message || `error ${code}`));
      setStatus("connected");
    },
    [syncFromRoom]
  );

  const run = useCallback(
    async (fn: () => Promise<Room>) => {
      try {
        intentionalRef.current = false;
        setStatus("connecting");
        setError("");
        attach(await fn());
      } catch (e: any) {
        setError(friendlyError(e));
        setStatus("error");
      }
    },
    [attach]
  );

  // Переподключение после обрыва: несколько попыток с нарастающей паузой
  // (суммарно ~21с, укладываемся в серверное окно allowReconnection = 30с).
  const attemptReconnect = useCallback(
    async (token: string) => {
      if (!token) {
        setStatus("idle");
        setSnapshot(EMPTY);
        return;
      }
      setStatus("reconnecting");
      const delays = [1000, 2000, 4000, 6000, 8000];
      for (const d of delays) {
        await new Promise((r) => setTimeout(r, d));
        if (intentionalRef.current) return; // пользователь вышел во время попыток
        try {
          const room = await getClient().reconnect(token);
          attach(room);
          return;
        } catch {
          /* следующая попытка */
        }
      }
      setError(t("err.reconnectFailed"));
      setStatus("error");
      setSnapshot(EMPTY);
    },
    [attach, getClient]
  );

  useEffect(() => {
    reconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  const createGame = useCallback(
    (name: string, opts: CreateOpts) =>
      run(() =>
        getClient().create("game", {
          name,
          lobbyName: opts.lobbyName,
          isPrivate: opts.isPrivate,
          maxPlayers: opts.maxPlayers,
          hostLevel: opts.hostLevel,
        })
      ),
    [run, getClient]
  );

  const joinById = useCallback(
    (roomId: string, name: string) =>
      run(() => getClient().joinById(roomId, { name })),
    [run, getClient]
  );

  // Быстрая игра: войти в случайное открытое лобби, иначе создать своё.
  const quickPlay = useCallback(
    (name: string) =>
      run(async () => {
        const client = getClient();
        try {
          const res = await fetch(`${TOKEN_BASE}/rooms`);
          const rooms = await res.json();
          const open = (Array.isArray(rooms) ? rooms : []).filter(
            (r: any) => r.phase === "lobby" && r.clients < r.maxClients
          );
          if (open.length) {
            const pick = open[Math.floor(Math.random() * open.length)];
            return await client.joinById(pick.roomId, { name });
          }
        } catch {}
        return await client.create("game", {
          name, lobbyName: `Игра ${name}`, isPrivate: false, maxPlayers: 8, hostLevel: "normal",
        });
      }),
    [run, getClient]
  );

  const joinByCode = useCallback(
    (code: string, name: string) =>
      run(async () => {
        const res = await fetch(`${TOKEN_BASE}/rooms/by-code?code=${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(t("err.codeNotFound"));
        const { roomId } = await res.json();
        return getClient().joinById(roomId, { name });
      }),
    [run, getClient]
  );

  const setReady = useCallback((ready: boolean) => {
    roomRef.current?.send(ClientMsg.SetReady, { ready });
  }, []);

  const setMediaReady = useCallback((ready: boolean) => {
    roomRef.current?.send(ClientMsg.MediaReady, { ready });
  }, []);

  // Сообщить серверу, видно ли лицо (анти-чит «прячет лицо»).
  const reportFace = useCallback((visible: boolean) => {
    roomRef.current?.send(visible ? ClientMsg.FaceFound : ClientMsg.FaceLost);
  }, []);

  const startGame = useCallback(() => {
    roomRef.current?.send(ClientMsg.StartGame);
  }, []);

  const rematch = useCallback(() => {
    roomRef.current?.send(ClientMsg.Rematch);
  }, []);

  const smile = useCallback(() => {
    roomRef.current?.send(ClientMsg.SmileDetected, { confidence: 0.9, ts: Date.now() });
  }, []);

  const useItem = useCallback((itemId: string, targetId: string) => {
    roomRef.current?.send(ClientMsg.UseItem, { itemId, targetId });
  }, []);

  const leave = useCallback(() => {
    intentionalRef.current = true; // намеренный выход — не реконнектиться
    // Выходим мгновенно (не ждём ответ сервера), иначе UI «залипает» и кажется,
    // что кнопка не работает. room.leave() уходит фоном.
    try { roomRef.current?.leave(); } catch {}
    roomRef.current = null;
    setStatus("idle");
    setError("");
    setSnapshot(EMPTY);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
    setSnapshot(EMPTY);
  }, []);

  return {
    status, error, snapshot, mySessionId, roomId, taunt, itemEffect,
    createGame, joinById, joinByCode, quickPlay,
    setReady, setMediaReady, reportFace, startGame, rematch, smile, useItem, leave, reset,
  };
}
