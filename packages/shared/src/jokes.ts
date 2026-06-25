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

  // ── win (победитель / конец раунда) ──
  { cat: "normal", ctx: "win", text: "Неплохо держитесь, дружочки-пирожочки! Но {name} оказался крепче." },
  { cat: "normal", ctx: "win", text: "Ну что, мордашки, раунд окончен. {name} — наш каменный лик!" },
  { cat: "normal", ctx: "win", text: "Хорошая партия, печеньки. {name} сегодня не дрогнул." },
  { cat: "normal", ctx: "win", text: "{name} — железное лицо вечера! Остальные тренируйтесь." },
  { cat: "dark", ctx: "win", text: "{name} победил. Единственное достижение за сегодня — и то сомнительное." },
  { cat: "spicy", ctx: "win", text: "{name} не сломался. Видимо, нечему было ломаться." },

  // ════ РАСШИРЕННЫЙ ПАК (чёрный/жёсткий, в рамках) ════

  // hype
  { cat: "dark", ctx: "hype", text: "{name}, дыши ровно. Скоро это закончится. Как и всё хорошее." },
  { cat: "dark", ctx: "hype", text: "{name}, твоя выдержка трещит громче, чем твоя кредитная история." },
  { cat: "dark", ctx: "hype", text: "Где-то сейчас плачет психотерапевт {name}. Но не от смеха." },
  { cat: "dark", ctx: "hype", text: "{name}, держись. Хотя бы тут можешь не сдаться первым." },
  { cat: "dark", ctx: "hype", text: "{name}, не улыбайся. Зубы всё равно показывать стыдно." },
  { cat: "dark", ctx: "hype", text: "Камера любит {name}. Больше никто, но камера — да." },
  { cat: "spicy", ctx: "hype", text: "{name}, сожми булки и лицо. В таком порядке." },
  { cat: "spicy", ctx: "hype", text: "{name}, ты потеешь. Это страх или ты опять что-то скрываешь?" },
  { cat: "spicy", ctx: "hype", text: "{name}, не ржи. Соседи и так думают, что ты со странностями." },
  { cat: "spicy", ctx: "hype", text: "{name}, твоё лицо сейчас — единственное, что у тебя под контролем." },

  // card
  { cat: "dark", ctx: "card", text: "Жёлтая, {name}. Жизнь тебя готовила к этому провалу годами." },
  { cat: "dark", ctx: "card", text: "{name} треснул. Как и все твои новогодние обещания." },
  { cat: "dark", ctx: "card", text: "Карточка для {name}. Аплодисменты в полупустом зале." },
  { cat: "dark", ctx: "card", text: "{name}, ещё одна улыбка — и ты history. В плохом смысле." },
  { cat: "spicy", ctx: "card", text: "{name} не сдержался. Опять. История твоей жизни, а?" },
  { cat: "spicy", ctx: "card", text: "Жёлтая, {name}. Слабоват ты на передок и на лицо." },
  { cat: "spicy", ctx: "card", text: "{name} поплыл. Бухаешь — плывёшь, играешь — плывёшь. Талант." },

  // out
  { cat: "dark", ctx: "out", text: "{name} выбыл. Земля ему пухом, игре — облегчение." },
  { cat: "dark", ctx: "out", text: "Минус {name}. Никто не заметит, как обычно." },
  { cat: "dark", ctx: "out", text: "{name} сломался первым. Семейная традиция, не иначе." },
  { cat: "dark", ctx: "out", text: "Прощай, {name}. Ты сиял ярко… секунды три." },
  { cat: "spicy", ctx: "out", text: "{name} вылетел быстрее, чем сбегает с первого свидания." },
  { cat: "spicy", ctx: "out", text: "{name} слился. Хоть в чём-то стабилен, и то хлеб." },
  { cat: "spicy", ctx: "out", text: "{name} готов. Иди погрусти, у тебя это лучше получается." },

  // duel
  { cat: "dark", ctx: "duel", text: "Двое. Один станет легендой, другой — поводом для терапии." },
  { cat: "dark", ctx: "duel", text: "Финал. {name}, не подведи — хотя кого я обманываю." },
  { cat: "spicy", ctx: "duel", text: "Дуэль. У кого яйца крепче — у того и лицо, {name}." },

  // win
  { cat: "dark", ctx: "win", text: "{name} выжил. Поздравляю с самой бессмысленной победой в жизни." },
  { cat: "dark", ctx: "win", text: "Чемпион {name}. Запиши в резюме, больше туда писать нечего." },
  { cat: "spicy", ctx: "win", text: "{name} — король каменных морд. Корона жмёт? Это совесть." },
  { cat: "spicy", ctx: "win", text: "{name} победил. Остальные — мягкотелые, во всех смыслах." },
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
