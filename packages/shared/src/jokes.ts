// Банк реплик ИИ-ведущего. Генерится/наполняется ОДИН РАЗ (здесь + батч-апдейты),
// в игре сервер просто выбирает подходящую → ноль токенов на игрока.
//
// cat: уровень — normal (мягко), dark (чёрный юмор), spicy (18+/жёстко).
//   Уровень лобби определяет, какие категории доступны.
// ctx: момент — hype (по ходу), card (кому-то карточка), out (вылет),
//   duel (остались двое), win (победитель).
// {name} подставляется сервером.

export type JokeCat = "normal" | "dark" | "spicy";
export type JokeCtx = "hype" | "card" | "out" | "duel" | "win";

export interface Joke {
  text: string;
  cat: JokeCat;
  ctx: JokeCtx;
}

export const JOKES: Joke[] = [
  // ── hype (нагнетание по ходу игры) ──
  { cat: "normal", ctx: "hype", text: "{name}, у тебя лицо человека, который вот-вот сломается." },
  { cat: "normal", ctx: "hype", text: "Тишина… только {name} борется с собой и проигрывает." },
  { cat: "normal", ctx: "hype", text: "Камера крупным планом на {name}. Улыбочку! Ой, нельзя." },
  { cat: "normal", ctx: "hype", text: "{name}, моргни, если тебя держат в заложниках у серьёзного лица." },
  { cat: "dark", ctx: "hype", text: "{name}, твоё лицо сейчас держится крепче, чем твои жизненные планы." },
  { cat: "dark", ctx: "hype", text: "Улыбнёшься — проиграешь. Как и всегда, {name}." },
  { cat: "dark", ctx: "hype", text: "{name}, не улыбайся. Поводов всё равно нет." },
  { cat: "spicy", ctx: "hype", text: "{name}, напряги лицо так же, как напрягаешь всех вокруг." },
  { cat: "spicy", ctx: "hype", text: "{name}, держи лицо. Хоть что-то у тебя должно стоять смирно." },

  // ── card (кому-то выдали жёлтую) ──
  { cat: "normal", ctx: "card", text: "{name} дрогнул! Жёлтая. Соберись, тряпочка." },
  { cat: "normal", ctx: "card", text: "Опа, {name} поплыл. Ещё разок — и до свидания." },
  { cat: "dark", ctx: "card", text: "{name}, одна нога уже в могиле этого раунда." },
  { cat: "dark", ctx: "card", text: "Жёлтая для {name}. Последнее предупреждение — как у врача." },
  { cat: "spicy", ctx: "card", text: "{name} кончил выдержку быстрее, чем хотелось бы. Жёлтая." },

  // ── out (вылет) ──
  { cat: "normal", ctx: "out", text: "{name} вылетел! Иди потренируйся перед зеркалом." },
  { cat: "normal", ctx: "out", text: "Всё, {name} сломался. Спасибо за участие, выход там." },
  { cat: "dark", ctx: "out", text: "{name} покинул нас. Не плачьте, он этого не стоил." },
  { cat: "dark", ctx: "out", text: "R.I.P. серьёзное лицо {name}. Прожило недолго и бесславно." },
  { cat: "spicy", ctx: "out", text: "{name} слился. Как обычно в ответственный момент." },

  // ── duel (остались двое) ──
  { cat: "normal", ctx: "duel", text: "Финал! {name} против последнего нерва соперника." },
  { cat: "dark", ctx: "duel", text: "Двое остались. Один уйдёт с позором, второй — тоже, но позже." },
  { cat: "spicy", ctx: "duel", text: "Дуэль. Кто первый расплывётся — тот и слабак, {name}." },

  // ── win (победитель) ──
  { cat: "normal", ctx: "win", text: "{name} — железное лицо вечера! Остальные тренируйтесь." },
  { cat: "dark", ctx: "win", text: "{name} победил. Единственное достижение за сегодня — и то сомнительное." },
  { cat: "spicy", ctx: "win", text: "{name} не сломался. Видимо, нечему было ломаться." },
];

// Какие категории разрешены для уровня лобби.
export const HOST_LEVELS = {
  off: [] as JokeCat[],
  normal: ["normal"] as JokeCat[],
  savage: ["normal", "dark", "spicy"] as JokeCat[],
};
export type HostLevel = keyof typeof HOST_LEVELS;

/** Выбрать случайную реплику под контекст и уровень. Возвращает шаблон ({name} ещё внутри). */
export function pickJoke(ctx: JokeCtx, level: HostLevel): string | null {
  const cats = HOST_LEVELS[level] || [];
  if (cats.length === 0) return null;
  const pool = JOKES.filter((j) => j.ctx === ctx && cats.includes(j.cat));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].text;
}
