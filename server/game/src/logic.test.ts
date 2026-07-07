import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG, GameMode } from "@pokerface/shared";
import {
  isContestant, cardColor, isEliminated, aliveContestants,
  resolveWinner, canStart, pushRateWindow, hidingAction, type PlayerLike,
} from "./logic";

const MAX = GAME_CONFIG.maxCards;
const MIN = GAME_CONFIG.minPlayersToStart;
const P = (id: string, over: Partial<PlayerLike> = {}): PlayerLike =>
  ({ id, eliminated: false, mediaReady: true, ...over });

test("isContestant: в классике все — участники", () => {
  assert.equal(isContestant(GameMode.Classic, "", "a"), true);
  assert.equal(isContestant(GameMode.Classic, "b", "b"), true); // judgeId игнорируется
});

test("isContestant: в режиме судьи судья — не участник", () => {
  assert.equal(isContestant(GameMode.Judge, "j", "j"), false);
  assert.equal(isContestant(GameMode.Judge, "j", "a"), true);
});

test("cardColor / isEliminated: последняя карта — красная и вылет", () => {
  assert.equal(cardColor(1, 2), "yellow");
  assert.equal(cardColor(2, 2), "red");
  assert.equal(isEliminated(1, 2), false);
  assert.equal(isEliminated(2, 2), true);
  assert.equal(isEliminated(3, 2), true);
  // с конфигом по умолчанию
  assert.equal(isEliminated(MAX), true);
  assert.equal(isEliminated(MAX - 1), false);
});

test("aliveContestants: исключает вылетевших и судью", () => {
  const players = [P("a"), P("b", { eliminated: true }), P("j")];
  const classic = aliveContestants(players, GameMode.Classic, "j").map((p) => p.id);
  assert.deepEqual(classic, ["a", "j"]); // судья считается в классике
  const judge = aliveContestants(players, GameMode.Judge, "j").map((p) => p.id);
  assert.deepEqual(judge, ["a"]); // судья исключён, b вылетел
});

test("resolveWinner: игра продолжается при >1 живом", () => {
  assert.equal(resolveWinner([P("a"), P("b")], GameMode.Classic, ""), null);
});

test("resolveWinner: один живой — победитель", () => {
  const players = [P("a"), P("b", { eliminated: true })];
  assert.equal(resolveWinner(players, GameMode.Classic, ""), "a");
});

test("resolveWinner: никого живого — пустая строка", () => {
  const players = [P("a", { eliminated: true }), P("b", { eliminated: true })];
  assert.equal(resolveWinner(players, GameMode.Classic, ""), "");
});

test("resolveWinner: в режиме судьи судья не мешает определить победителя", () => {
  // судья + 1 живой участник → победитель участник (судья не в счёте)
  const players = [P("j"), P("a"), P("b", { eliminated: true })];
  assert.equal(resolveWinner(players, GameMode.Judge, "j"), "a");
});

test("canStart: классика — нужны >= MIN игроков с камерой+миком", () => {
  const players = Array.from({ length: MIN }, (_, i) => P(`p${i}`));
  assert.equal(canStart(players, GameMode.Classic, ""), true);
});

test("canStart: false если не у всех mediaReady", () => {
  const players = [P("a"), P("b", { mediaReady: false })];
  assert.equal(canStart(players, GameMode.Classic, ""), false);
});

test("canStart: false если игроков меньше минимума", () => {
  const players = Array.from({ length: MIN - 1 }, (_, i) => P(`p${i}`));
  assert.equal(canStart(players, GameMode.Classic, ""), false);
});

test("canStart: false для пустого лобби", () => {
  assert.equal(canStart([], GameMode.Classic, ""), false);
});

test("canStart: режим судьи — нужен назначенный судья", () => {
  const players = [P("j"), ...Array.from({ length: MIN }, (_, i) => P(`p${i}`))];
  assert.equal(canStart(players, GameMode.Judge, ""), false);      // судья не назначен
  assert.equal(canStart(players, GameMode.Judge, "j"), true);      // назначен + MIN участников
});

test("canStart: режим судьи — судья не считается за участника", () => {
  // судья + (MIN-1) участников → участников не хватает
  const players = [P("j"), ...Array.from({ length: MIN - 1 }, (_, i) => P(`p${i}`))];
  assert.equal(canStart(players, GameMode.Judge, "j"), false);
});

test("pushRateWindow: под лимитом — не режем", () => {
  let times: number[] = [];
  let limited = false;
  for (let i = 0; i < 5; i++) ({ times, limited } = pushRateWindow(times, 1000 + i, 1000, 25));
  assert.equal(limited, false);
  assert.equal(times.length, 5);
});

test("pushRateWindow: превышение лимита режется", () => {
  let times: number[] = [];
  let limited = false;
  for (let i = 0; i <= 25; i++) ({ times, limited } = pushRateWindow(times, 1000, 1000, 25)); // 26 в одну мс
  assert.equal(limited, true);
});

test("pushRateWindow: старые метки вне окна очищаются", () => {
  const { times, limited } = pushRateWindow([0, 1, 2], 5000, 1000, 25);
  assert.deepEqual(times, [5000]); // всё старше окна выкинуто
  assert.equal(limited, false);
});

test("hidingAction: до грейса — ничего", () => {
  assert.equal(hidingAction(1000, 3000, 8000, false), "none");
});

test("hidingAction: после грейса, ещё не предупреждён — предупреждение", () => {
  assert.equal(hidingAction(3000, 3000, 8000, false), "warn");
});

test("hidingAction: уже предупреждён — повторно не варнит", () => {
  assert.equal(hidingAction(5000, 3000, 8000, true), "none");
});

test("hidingAction: после порога штрафа — штраф (независимо от предупреждения)", () => {
  assert.equal(hidingAction(8000, 3000, 8000, false), "penalty");
  assert.equal(hidingAction(9000, 3000, 8000, true), "penalty");
});
