// ИИ-ведущий: генерирует реплики на лету вместо готового банка.
// Ключ живёт ТОЛЬКО в env сервера (Render → Environment), в клиент не попадает.
// Без ключа/при ошибке/таймауте возвращаем null — комната молча падает на банк
// шуток, поэтому игра никогда не ломается из-за ИИ.
//
// Провайдер сменный: сейчас DeepSeek (OpenAI-совместимый API, дёшево и есть
// стартовый грант). Claude можно добавить рядом — интерфейс не изменится.
import { HostLevel, JokeCtx } from "@pokerface/shared";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
// Внимание: id "deepseek-chat"/"deepseek-reasoner" устаревают 2026-07-24,
// поэтому по умолчанию берём актуальный. Переопределяется env DEEPSEEK_MODEL.
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const TIMEOUT_MS = 3500; // шутка, опоздавшая на секунды, — мёртвая шутка
const MAX_TOKENS = 80;
const MAX_LEN = 180;     // длинную реплику никто не дочитает

export interface AiTauntReq {
  ctx: JokeCtx;
  level: HostLevel;
  targetName?: string;
  alive: string[];
  recent: string[]; // последние реплики — чтобы ИИ не повторялся
}

export function hasAiHost(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

function systemPrompt(level: HostLevel): string {
  const base = [
    "Ты — ведущий онлайн-игры «не улыбнись»: игроки сидят на веб-камерах и проигрывают, если улыбнутся.",
    "Твоя задача — ОДНОЙ короткой репликой (до 12 слов) подколоть игроков так, чтобы они не удержали лицо.",
    "Пиши по-русски, живо и разговорно. Только сама реплика: без кавычек, без вступлений, без пояснений.",
  ];
  if (level === "savage") {
    base.push("Юмор жёсткий, чёрный, 18+. Можно дерзко и с сарказмом.");
  } else {
    base.push("Юмор дружеский и лёгкий, без грубости.");
  }
  // Рамки: подкалываем ситуацию и поведение, а не человека по признакам.
  base.push(
    "Запрещено: оскорбления по национальности, религии, полу, ориентации; шутки про внешность, вес, болезни и смерть близких; угрозы. Подкалывай ситуацию в игре, а не личность."
  );
  return base.join(" ");
}

function userPrompt(r: AiTauntReq): string {
  const who = r.targetName || "кто-нибудь";
  const moment: Record<JokeCtx, string> = {
    hype: `Идёт раунд, все держат лицо. Живые игроки: ${r.alive.join(", ") || "—"}. Подколи их или ${who}.`,
    card: `${who} дрогнул и получил жёлтую карточку. Прокомментируй.`,
    out: `${who} улыбнулся второй раз и вылетел из игры. Проводи его.`,
    duel: `Остались двое: ${r.alive.join(" и ")}. Накали обстановку.`,
    win: `${who} победил — ни разу не улыбнулся. Поздравь в своём стиле.`,
  };
  const parts = [moment[r.ctx]];
  if (r.recent.length) parts.push(`Не повторяй по смыслу эти реплики: ${r.recent.slice(-4).join(" | ")}`);
  return parts.join("\n");
}

/** Причесать ответ модели: одна строка, без кавычек, не длиннее MAX_LEN. */
function clean(s: string): string | null {
  let t = (s || "").trim().split("\n")[0].trim();
  t = t.replace(/^["«»'`]+|["«»'`]+$/g, "").trim();
  if (!t) return null;
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN).trim() : t;
}

/** Сгенерировать реплику. null — нет ключа, ошибка, таймаут или пустой ответ. */
export async function generateTaunt(req: AiTauntReq): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 1.1, // нужен разброс, иначе ведущий повторяется
        messages: [
          { role: "system", content: systemPrompt(req.level) },
          { role: "user", content: userPrompt(req) },
        ],
      }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.warn(`[ai-host] ${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
      return null;
    }
    const data: any = await res.json();
    return clean(data?.choices?.[0]?.message?.content || "");
  } catch (e: any) {
    console.warn("[ai-host] сбой:", e?.name === "AbortError" ? "таймаут" : e?.message);
    return null; // фолбэк на банк шуток
  } finally {
    clearTimeout(timer);
  }
}
