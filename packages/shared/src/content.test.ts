import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOKES, HOST_LEVELS, pickJoke, type JokeCtx,
  ITEMS, itemCharges, randomMeme, randomSticker, MEMES, STICKERS,
  QUIZ_PROMPTS, pickQuizPrompt,
} from "./index";

// Подменяем Math.random на детерминированное значение на время колбэка.
function withRandom<T>(value: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = orig; }
}

const ALL_CTX: JokeCtx[] = ["hype", "card", "out", "duel", "win"];

test("pickJoke: уровень off — всегда null", () => {
  for (const ctx of ALL_CTX) assert.equal(pickJoke(ctx, "off"), null);
});

test("pickJoke: normal возвращает только реплики категории normal", () => {
  const normalCardTexts = new Set(JOKES.filter((j) => j.ctx === "card" && j.cat === "normal").map((j) => j.text));
  for (let i = 0; i < 100; i++) {
    const t = pickJoke("card", "normal");
    assert.ok(t && normalCardTexts.has(t), `не-normal реплика просочилась: ${t}`);
  }
});

test("pickJoke: savage допускает dark/spicy", () => {
  const savageCats = HOST_LEVELS.savage;
  const allowed = new Set(JOKES.filter((j) => j.ctx === "hype" && savageCats.includes(j.cat)).map((j) => j.text));
  for (let i = 0; i < 100; i++) {
    const t = pickJoke("hype", "savage");
    assert.ok(t && allowed.has(t));
  }
});

test("pickJoke: детерминирован при фиксированном Math.random", () => {
  const pool = JOKES.filter((j) => j.ctx === "out" && HOST_LEVELS.normal.includes(j.cat));
  const first = withRandom(0, () => pickJoke("out", "normal"));
  assert.equal(first, pool[0].text); // random=0 → первый элемент пула
});

test("pickJoke: каждый контекст имеет хотя бы одну normal-реплику", () => {
  for (const ctx of ALL_CTX) {
    assert.ok(pickJoke(ctx, "normal") !== null, `нет normal-реплики для ctx=${ctx}`);
  }
});

test("HOST_LEVELS: normal — только normal, savage — все три", () => {
  assert.deepEqual(HOST_LEVELS.off, []);
  assert.deepEqual(HOST_LEVELS.normal, ["normal"]);
  assert.deepEqual([...HOST_LEVELS.savage].sort(), ["dark", "normal", "spicy"]);
});

test("itemCharges: известные предметы и неизвестный", () => {
  assert.equal(itemCharges("meme"), 3);
  assert.equal(itemCharges("host"), 2);
  assert.equal(itemCharges("нет-такого" as any), 0);
});

test("ITEMS: id уникальны и заряд положительный", () => {
  const ids = ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "дубли id предметов");
  for (const it of ITEMS) assert.ok(it.charges > 0, `${it.id} без зарядов`);
});

test("randomMeme/randomSticker: всегда из своего набора", () => {
  for (let i = 0; i < 50; i++) {
    assert.ok(MEMES.includes(randomMeme()));
    assert.ok(STICKERS.includes(randomSticker()));
  }
});

test("randomMeme: границы random → первый и последний", () => {
  assert.equal(withRandom(0, randomMeme), MEMES[0]);
  assert.equal(withRandom(0.999999, randomMeme), MEMES[MEMES.length - 1]);
});

test("QUIZ_PROMPTS: id уникальны, форма по типу корректна", () => {
  const ids = QUIZ_PROMPTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "дубли id вопросов");
  for (const p of QUIZ_PROMPTS) {
    assert.ok(p.text.trim().length > 0, `${p.id}: пустой текст`);
    if (p.kind === "options") {
      assert.ok((p.options?.length ?? 0) >= 2, `${p.id}: нужно ≥2 вариантов`);
    } else {
      // «кто скорее всего» — варианты подставляются игроками на сервере
      assert.equal(p.options, undefined, `${p.id}: у kind=who не должно быть options`);
    }
  }
});

test("pickQuizPrompt: не повторяет использованные, пока банк не исчерпан", () => {
  const used: string[] = [];
  for (let i = 0; i < QUIZ_PROMPTS.length; i++) {
    const p = pickQuizPrompt(used);
    assert.ok(!used.includes(p.id), `повтор вопроса ${p.id}`);
    used.push(p.id);
  }
  // банк исчерпан → начинает заново, а не падает
  const again = pickQuizPrompt(used);
  assert.ok(QUIZ_PROMPTS.some((p) => p.id === again.id));
});

test("pickQuizPrompt: пустой список использованных — просто отдаёт вопрос", () => {
  const p = pickQuizPrompt();
  assert.ok(QUIZ_PROMPTS.some((x) => x.id === p.id));
});
