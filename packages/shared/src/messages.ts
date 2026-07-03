// Имена сообщений и фазы игры — общий протокол клиент ↔ сервер.

/** Фазы матча (конечный автомат из ARCHITECTURE.md). */
export const Phase = {
  Lobby: "lobby",
  Countdown: "countdown",
  Playing: "playing",
  GameOver: "game_over",
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

/** Режимы игры (выбираются при создании лобби). */
export const GameMode = {
  Classic: "classic", // авто-детект улыбки (текущий)
  Judge: "judge",     // ведущий-человек судит и выдаёт карточки
  AI: "ai",           // ИИ-ведущий (бета)
  Board: "board",     // интерактивная доска — рассмешить других
} as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

/** Клиент → Сервер. */
export const ClientMsg = {
  SetReady: "set_ready",
  StartGame: "start_game",
  SmileDetected: "smile_detected",
  FaceLost: "face_lost",
  FaceFound: "face_found",
  Rematch: "rematch",
  UseItem: "use_item",
  MediaReady: "media_ready",   // камера+микрофон подключены у игрока
  SetJudge: "set_judge",       // host назначает судью (режим judge)
  SmileLevel: "smile_level",   // игрок шлёт свой % улыбки (сервер relay судье)
  JudgeCard: "judge_card",     // судья выдаёт карточку игроку
  BoardOp: "board_op",         // операция на доске (режим board): штрих/текст/очистка
} as const;

/** Сервер → Клиент (поверх авто-синка состояния комнаты). */
export const ServerMsg = {
  CardIssued: "card_issued",
  PlayerEliminated: "player_eliminated",
  PhaseChanged: "phase_changed",
  GameOver: "game_over",
  Taunt: "taunt",
  ItemUsed: "item_used",
  SmileLevel: "smile_level", // сервер → судья: % улыбки конкретного игрока
  BoardOp: "board_op",       // сервер → все: операция на доске (relay)
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
