// Локальная статистика игрока для удержания: сыграно матчей + стрик дней подряд.
export interface Stats {
  matches: number;
  streak: number;
  lastDate: string;
}

const KEY = "pokerface.stats";
let cache: Stats | null = null;

function load(): Stats {
  if (cache) return cache;
  try {
    if (typeof localStorage !== "undefined") {
      const r = localStorage.getItem(KEY);
      if (r) cache = JSON.parse(r);
    }
  } catch {}
  if (!cache) cache = { matches: 0, streak: 0, lastDate: "" };
  return cache;
}

export function getStats(): Stats {
  return load();
}

// Засчитать сыгранный матч: +1 матч, обновить стрик по датам.
export function recordMatch(): Stats {
  const s = load();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (s.lastDate !== today) {
    s.streak = s.lastDate === yesterday ? s.streak + 1 : 1;
    s.lastDate = today;
  }
  s.matches += 1;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  return s;
}
