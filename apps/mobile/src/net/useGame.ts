import { useCallback, useRef, useState } from "react";
import { Client, Room } from "colyseus.js";
import { ClientMsg, ServerMsg, Phase, HostLevel } from "@pokerface/shared";
import { SERVER_ENDPOINT, TOKEN_BASE } from "./config";

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
}

export interface GameSnapshot {
  phase: string;
  lobbyName: string;
  code: string;
  hostId: string;
  winnerId: string;
  players: PlayerView[];
}

export type Status = "idle" | "connecting" | "connected" | "error";

const EMPTY: GameSnapshot = { phase: Phase.Lobby, lobbyName: "", code: "", hostId: "", winnerId: "", players: [] };

// Хук подключения к игровому серверу. Зеркалит состояние комнаты в React.
export function useGame() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY);
  const [mySessionId, setMySessionId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [taunt, setTaunt] = useState<{ text: string; ts: number }>({ text: "", ts: 0 });
  const roomRef = useRef<Room | null>(null);

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
      });
    });
    setSnapshot({
      phase: state.phase,
      lobbyName: state.lobbyName,
      code: state.code,
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
      room.onStateChange(() => syncFromRoom(room));
      room.onMessage(ServerMsg.Taunt, (m: { text: string }) =>
        setTaunt({ text: m.text, ts: Date.now() })
      );
      room.onLeave(() => {
        setStatus("idle");
        setSnapshot(EMPTY);
        roomRef.current = null;
      });
      room.onError((code, message) => setError(message || `error ${code}`));
      setStatus("connected");
    },
    [syncFromRoom]
  );

  const run = useCallback(
    async (fn: () => Promise<Room>) => {
      try {
        setStatus("connecting");
        setError("");
        attach(await fn());
      } catch (e: any) {
        setError(e?.message || "Не удалось подключиться");
        setStatus("error");
      }
    },
    [attach]
  );

  const createGame = useCallback(
    (name: string, opts: CreateOpts) =>
      run(() =>
        new Client(SERVER_ENDPOINT).create("game", {
          name,
          lobbyName: opts.lobbyName,
          isPrivate: opts.isPrivate,
          maxPlayers: opts.maxPlayers,
          hostLevel: opts.hostLevel,
        })
      ),
    [run]
  );

  const joinById = useCallback(
    (roomId: string, name: string) =>
      run(() => new Client(SERVER_ENDPOINT).joinById(roomId, { name })),
    [run]
  );

  const joinByCode = useCallback(
    (code: string, name: string) =>
      run(async () => {
        const res = await fetch(`${TOKEN_BASE}/rooms/by-code?code=${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error("Лобби с таким кодом не найдено");
        const { roomId } = await res.json();
        return new Client(SERVER_ENDPOINT).joinById(roomId, { name });
      }),
    [run]
  );

  const setReady = useCallback((ready: boolean) => {
    roomRef.current?.send(ClientMsg.SetReady, { ready });
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

  const leave = useCallback(() => {
    roomRef.current?.leave();
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError("");
    setSnapshot(EMPTY);
  }, []);

  return {
    status, error, snapshot, mySessionId, roomId, taunt,
    createGame, joinById, joinByCode,
    setReady, startGame, rematch, smile, leave, reset,
  };
}
