import { useCallback, useRef, useState } from "react";
import { Client, Room } from "colyseus.js";
import { ClientMsg, ServerMsg, Phase } from "@pokerface/shared";
import { SERVER_ENDPOINT } from "./config";

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
  hostId: string;
  winnerId: string;
  players: PlayerView[];
}

export type Status = "idle" | "connecting" | "connected" | "error";

const EMPTY: GameSnapshot = { phase: Phase.Lobby, hostId: "", winnerId: "", players: [] };

// Хук подключения к игровому серверу. Зеркалит состояние комнаты в React.
export function useGame() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY);
  const [mySessionId, setMySessionId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
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
      hostId: state.hostId,
      winnerId: state.winnerId,
      players,
    });
  }, []);

  const connect = useCallback(
    async (name: string) => {
      try {
        setStatus("connecting");
        setError("");
        const client = new Client(SERVER_ENDPOINT);
        const room = await client.joinOrCreate("game", { name });
        roomRef.current = room;
        setMySessionId(room.sessionId);
        setRoomId(room.roomId);
        room.onStateChange((s) => syncFromRoom(room));
        room.onLeave(() => {
          setStatus("idle");
          setSnapshot(EMPTY);
          roomRef.current = null;
        });
        room.onError((code, message) => setError(message || `error ${code}`));
        setStatus("connected");
      } catch (e: any) {
        setError(e?.message || "Не удалось подключиться");
        setStatus("error");
      }
    },
    [syncFromRoom]
  );

  const setReady = useCallback((ready: boolean) => {
    roomRef.current?.send(ClientMsg.SetReady, { ready });
  }, []);

  const startGame = useCallback(() => {
    roomRef.current?.send(ClientMsg.StartGame);
  }, []);

  const smile = useCallback(() => {
    roomRef.current?.send(ClientMsg.SmileDetected, { confidence: 0.9, ts: Date.now() });
  }, []);

  const leave = useCallback(() => {
    roomRef.current?.leave();
  }, []);

  return { status, error, snapshot, mySessionId, roomId, connect, setReady, startGame, smile, leave };
}
