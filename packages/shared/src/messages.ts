// Имена сообщений и фазы игры — общий протокол клиент ↔ сервер.

/** Фазы матча (конечный автомат из ARCHITECTURE.md). */
export const Phase = {
  Lobby: "lobby",
  Countdown: "countdown",
  Playing: "playing",
  GameOver: "game_over",
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

/** Клиент → Сервер. */
export const ClientMsg = {
  SetReady: "set_ready",
  StartGame: "start_game",
  SmileDetected: "smile_detected",
  FaceLost: "face_lost",
  FaceFound: "face_found",
  Rematch: "rematch",
} as const;

/** Сервер → Клиент (поверх авто-синка состояния комнаты). */
export const ServerMsg = {
  CardIssued: "card_issued",
  PlayerEliminated: "player_eliminated",
  PhaseChanged: "phase_changed",
  GameOver: "game_over",
  Taunt: "taunt",
} as const;

/** Цвет карточки по количеству. */
export type CardColor = "yellow" | "red";

export interface SmileDetectedPayload {
  confidence: number; // [0..1]
  ts: number;
}
export interface CardIssuedPayload {
  playerId: string;
  cards: number;
  color: CardColor;
}
