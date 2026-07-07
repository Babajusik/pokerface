// Чистая игровая логика (без Colyseus/сети) — единый источник правил и точка
// для юнит-тестов. GameRoom вызывает эти функции; здесь никаких side-effect'ов.
import { GAME_CONFIG, GameMode } from "@pokerface/shared";

export interface PlayerLike {
  id: string;
  eliminated?: boolean;
  mediaReady?: boolean;
}

// Судья (режим judge) — не участник: не получает карточки, не считается в победе.
export function isContestant(mode: string, judgeId: string, playerId: string): boolean {
  return mode !== GameMode.Judge || playerId !== judgeId;
}

// Цвет карточки по количеству: последняя (>= maxCards) — красная (вылет), иначе жёлтая.
export function cardColor(cards: number, maxCards = GAME_CONFIG.maxCards): "red" | "yellow" {
  return cards >= maxCards ? "red" : "yellow";
}

export function isEliminated(cards: number, maxCards = GAME_CONFIG.maxCards): boolean {
  return cards >= maxCards;
}

// Живые участники (не вылетевшие; судья исключён).
export function aliveContestants<T extends PlayerLike>(players: T[], mode: string, judgeId: string): T[] {
  return players.filter((p) => isContestant(mode, judgeId, p.id) && !p.eliminated);
}

// Победитель: если живых участников <= 1 — вернуть его id (или "" если никого),
// иначе null (игра продолжается).
export function resolveWinner(players: PlayerLike[], mode: string, judgeId: string): string | null {
  const alive = aliveContestants(players, mode, judgeId);
  return alive.length <= 1 ? (alive[0]?.id ?? "") : null;
}

// Можно ли стартовать матч (гейт host'а tryStart): у всех камера+мик, и хватает
// участников. В режиме судьи нужен назначенный судья + минимум участников без него.
export function canStart(
  players: PlayerLike[],
  mode: string,
  judgeId: string,
  minPlayers = GAME_CONFIG.minPlayersToStart
): boolean {
  if (players.length === 0) return false;
  if (!players.every((p) => p.mediaReady)) return false;
  if (mode === GameMode.Judge) {
    if (!judgeId || !players.some((p) => p.id === judgeId)) return false;
    return players.filter((p) => p.id !== judgeId).length >= minPlayers;
  }
  return players.length >= minPlayers;
}

// Скользящее окно анти-флуда: чистим старые метки, добавляем текущую, сообщаем
// о превышении. Возвращает обновлённый массив (его надо сохранить обратно).
export function pushRateWindow(
  times: number[],
  now: number,
  windowMs: number,
  max: number
): { times: number[]; limited: boolean } {
  const arr = times.filter((t) => now - t < windowMs);
  arr.push(now);
  return { times: arr, limited: arr.length > max };
}

// Анти-чит «прячет лицо»: по времени скрытия решаем — штраф, предупреждение или ничего.
export function hidingAction(
  hiddenMs: number,
  warnMs: number,
  penaltyMs: number,
  alreadyWarned: boolean
): "penalty" | "warn" | "none" {
  if (hiddenMs >= penaltyMs) return "penalty";
  if (hiddenMs >= warnMs && !alreadyWarned) return "warn";
  return "none";
}
