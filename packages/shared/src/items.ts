// Арсенал «провокатора»: предметы, которыми сбивают соперника, чтобы он улыбнулся.
// Контент бесплатный (эмодзи/текст), без внешних сервисов и копирайта.

export interface Item {
  id: ItemId;
  emoji: string;
  label: string;
  charges: number; // запас на раунд
}
export type ItemId = "meme" | "sound" | "sticker" | "host";

export const ITEMS: Item[] = [
  { id: "meme", emoji: "😂", label: "Мем", charges: 3 },
  { id: "sound", emoji: "🔊", label: "Звук", charges: 3 },
  { id: "sticker", emoji: "🤡", label: "Стикер", charges: 3 },
  { id: "host", emoji: "💬", label: "Ведущий", charges: 2 },
];

export const ITEM_COOLDOWN_MS = 1500; // общий кулдаун между применениями

export function itemCharges(id: ItemId): number {
  return ITEMS.find((i) => i.id === id)?.charges ?? 0;
}

// Мем-карточки (короткий панч на весь экран жертвы).
export const MEMES: string[] = [
  "🐸☕ Это не моё дело, конечно...",
  "🤡 А вот и ты!",
  "💀 Держись, осталось недолго",
  "🥴 Лицо просило кирпича",
  "📸 Этот кадр уйдёт в семейный архив",
  "🍞 Ты сейчас как масло — вот-вот растечёшься",
  "🤣 Не смешно. Совсем. Ага.",
  "😐➡️😂 Запускаю обратный отсчёт до твоей улыбки",
  "🪦 Тут будет покоиться твоя серьёзность",
  "🤓 Технически ты уже проиграл",
];

// Стикеры — большой эмодзи поверх экрана жертвы.
export const STICKERS: string[] = ["🤡", "👃", "👀", "🥸", "🤪", "👽", "🐷", "💩"];

export function randomMeme(): string {
  return MEMES[Math.floor(Math.random() * MEMES.length)];
}
export function randomSticker(): string {
  return STICKERS[Math.floor(Math.random() * STICKERS.length)];
}
