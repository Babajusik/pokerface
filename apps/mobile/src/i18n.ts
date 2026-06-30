// Лёгкая i18n для web: словари RU/EN + t() с подстановкой {vars}.
// Текущий язык хранится в настройках (localStorage). Компоненты подписываются
// через useLang() — при смене языка перерисовываются.
import { useSyncExternalStore } from "react";
import { getSettings, saveSettings } from "./settings";

export type Lang = "ru" | "en";

type Dict = Record<string, string>;

const ru: Dict = {
  // меню
  "app.subtitle": "Не улыбайся. Останься последним.",
  "menu.namePlaceholder": "Твоё имя",
  "menu.quickPlay": "⚡ Быстрая игра",
  "menu.create": "➕ Создать",
  "menu.find": "🔍 Найти",
  "menu.invite": "🎟️ Позови друзей",
  "menu.inviteCopied": "✓ Ссылка скопирована",
  "menu.settings": "⚙ Настройки",
  "menu.enterName": "Введи имя, чтобы играть",
  "menu.days": "дн.",
  "menu.matches": "матчей",
  "menu.online": "онлайн",
  "menu.inviteText": "Го рубиться в PokerFace — кто дольше не улыбнётся! {url}",
  // общее
  "common.back": "‹ Назад",
  "common.leave": "Выйти",
  "common.you": "Ты",
  // создание
  "create.title": "Создать игру",
  "create.lobbyName": "Название лобби",
  "create.access": "Доступ",
  "create.open": "Открытое",
  "create.byCode": "По коду",
  "create.maxPlayers": "Макс. игроков: {n}",
  "create.host": "ИИ-ведущий (юмор)",
  "create.hostOff": "Выкл",
  "create.hostNormal": "Обычный",
  "create.hostSavage": "Жёсткий 18+",
  "create.savageWarn": "⚠ Чёрный юмор и 18+. Только для компании взрослых.",
  "create.submit": "Создать и войти",
  // поиск
  "list.title": "Найти игру",
  "list.codePlaceholder": "Код лобби",
  "list.enter": "Войти",
  "list.openLobbies": "Открытые лобби",
  "list.loadError": "Не удалось загрузить лобби. Проверь соединение — список обновится сам.",
  "list.empty": "Пока нет открытых лобби. Создай своё!",
  "list.players": "{n}/{m} игроков",
  "list.full": "полное",
  "list.join": "Войти ›",
  // лобби
  "lobby.defaultName": "Лобби",
  "lobby.host": "ХОСТ",
  "lobby.code": "код: {code}",
  "lobby.counter": "{n} из {m}",
  "lobby.of": "из",
  "lobby.youSuffix": " (ты)",
  "lobby.ready": "готов ✓",
  "lobby.notReady": "не готов",
  "lobby.imReady": "Я готов",
  "lobby.imReadyOn": "✓ Готов",
  "lobby.start": "НАЧАТЬ",
  "lobby.needPlayers": "Нужно ≥2 игроков, и все должны быть готовы",
  "lobby.waitMedia": "Ждём камеру и микрофон у всех игроков…",
  "lobby.go": "GO!",
  // игра
  "game.over": "Игра окончена",
  "game.title": "Не улыбайся!",
  "game.playerDefault": "Игрок",
  "game.cards": "Карточки: {n}/2",
  "game.target": "Цель:",
  "game.noOpponents": "нет соперников",
  "game.youWon": "Ты победил! Железное лицо.",
  "game.winner": "Победитель: {name}",
  "game.nobody": "никто",
  "game.rematch": "↻ Реванш",
  "game.eliminated": "Ты вылетел. Жди финала…",
  "game.from": "от {name}",
  "game.gag": "🔊 {name} врубил гэг!",
  "game.showFace": "👀 Покажи лицо в камеру! Прячешься — получишь карточку.",
  // видео
  "video.disabled": "📹 Видео выключено. Добавь ключи LiveKit в server/game/.env и перезапусти сервер.",
  "video.vpn": "📡 Видео недоступно — в сетях РФ LiveKit обычно нужен VPN. Игра и детект работают и без видео. ({err})",
  "video.camDenied": "📷🎤 Доступ к камере/микрофону запрещён. Разреши его в настройках браузера.",
  "video.camNotFound": "📷🎤 Камера или микрофон не найдены.",
  "video.clipTitle": "🎬 Твой момент провала",
  "video.share": "📤 Поделиться",
  "video.download": "⬇ Скачать",
  // настройки
  "settings.title": "Настройки",
  "settings.name": "Имя",
  "settings.sound": "Звук",
  "settings.voice": "Голос ведущего",
  "settings.language": "Язык",
  // приложение
  "app.connecting": "Подключение…",
  "app.reconnecting": "Связь потеряна. Переподключаемся…",
  // предметы (по id)
  "item.meme": "Мем",
  "item.sound": "Звук",
  "item.sticker": "Стикер",
  "item.host": "Ведущий",
  // ошибки подключения
  "err.full": "Лобби заполнено или игра уже началась.",
  "err.closed": "Не удалось войти в лобби (возможно, оно закрыто).",
  "err.expired": "Приглашение в лобби истекло.",
  "err.noServer": "Сервер недоступен. Проверь соединение.",
  "err.generic": "Не удалось подключиться.",
  "err.codeNotFound": "Лобби с таким кодом не найдено",
  "err.reconnectFailed": "Связь потеряна — не удалось переподключиться.",
};

const en: Dict = {
  "app.subtitle": "Don't smile. Be the last one standing.",
  "menu.namePlaceholder": "Your name",
  "menu.quickPlay": "⚡ Quick play",
  "menu.create": "➕ Create",
  "menu.find": "🔍 Find",
  "menu.invite": "🎟️ Invite friends",
  "menu.inviteCopied": "✓ Link copied",
  "menu.settings": "⚙ Settings",
  "menu.enterName": "Enter a name to play",
  "menu.days": "days",
  "menu.matches": "matches",
  "menu.online": "online",
  "menu.inviteText": "Come play PokerFace — who can keep a straight face longest! {url}",
  "common.back": "‹ Back",
  "common.leave": "Leave",
  "common.you": "You",
  "create.title": "Create game",
  "create.lobbyName": "Lobby name",
  "create.access": "Access",
  "create.open": "Public",
  "create.byCode": "By code",
  "create.maxPlayers": "Max players: {n}",
  "create.host": "AI host (humor)",
  "create.hostOff": "Off",
  "create.hostNormal": "Normal",
  "create.hostSavage": "Savage 18+",
  "create.savageWarn": "⚠ Dark humor, 18+. For adults only.",
  "create.submit": "Create and join",
  "list.title": "Find game",
  "list.codePlaceholder": "Lobby code",
  "list.enter": "Join",
  "list.openLobbies": "Open lobbies",
  "list.loadError": "Couldn't load lobbies. Check your connection — the list refreshes itself.",
  "list.empty": "No open lobbies yet. Create your own!",
  "list.players": "{n}/{m} players",
  "list.full": "full",
  "list.join": "Join ›",
  "lobby.defaultName": "Lobby",
  "lobby.host": "HOST",
  "lobby.code": "code: {code}",
  "lobby.counter": "{n} of {m}",
  "lobby.of": "of",
  "lobby.youSuffix": " (you)",
  "lobby.ready": "ready ✓",
  "lobby.notReady": "not ready",
  "lobby.imReady": "I'm ready",
  "lobby.imReadyOn": "✓ Ready",
  "lobby.start": "START",
  "lobby.needPlayers": "Need ≥2 players, and everyone must be ready",
  "lobby.waitMedia": "Waiting for everyone's camera and microphone…",
  "lobby.go": "GO!",
  "game.over": "Game over",
  "game.title": "Don't smile!",
  "game.playerDefault": "Player",
  "game.cards": "Cards: {n}/2",
  "game.target": "Target:",
  "game.noOpponents": "no opponents",
  "game.youWon": "You won! Iron face.",
  "game.winner": "Winner: {name}",
  "game.nobody": "nobody",
  "game.rematch": "↻ Rematch",
  "game.eliminated": "You're out. Wait for the finale…",
  "game.from": "from {name}",
  "game.gag": "🔊 {name} dropped a gag!",
  "game.showFace": "👀 Show your face! Hiding gets you a card.",
  "video.disabled": "📹 Video off. Add LiveKit keys to server/game/.env and restart the server.",
  "video.vpn": "📡 Video unavailable — in RU networks LiveKit usually needs a VPN. The game and detection work without video. ({err})",
  "video.camDenied": "📷🎤 Camera/microphone access denied. Allow it in your browser settings.",
  "video.camNotFound": "📷🎤 Camera or microphone not found.",
  "video.clipTitle": "🎬 Your fail moment",
  "video.share": "📤 Share",
  "video.download": "⬇ Download",
  "settings.title": "Settings",
  "settings.name": "Name",
  "settings.sound": "Sound",
  "settings.voice": "Host voice",
  "settings.language": "Language",
  "app.connecting": "Connecting…",
  "app.reconnecting": "Connection lost. Reconnecting…",
  "item.meme": "Meme",
  "item.sound": "Sound",
  "item.sticker": "Sticker",
  "item.host": "Host",
  "err.full": "Lobby is full or the game has already started.",
  "err.closed": "Couldn't join the lobby (it may be closed).",
  "err.expired": "The lobby invite has expired.",
  "err.noServer": "Server unavailable. Check your connection.",
  "err.generic": "Couldn't connect.",
  "err.codeNotFound": "No lobby found with that code",
  "err.reconnectFailed": "Connection lost — couldn't reconnect.",
};

const dicts: Record<Lang, Dict> = { ru, en };

let current: Lang = (getSettings().lang as Lang) || "ru";
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  saveSettings({ lang: l });
  listeners.forEach((fn) => fn());
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? ru[key] ?? key;
  if (vars) {
    for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  }
  return s;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Хук: подписывает компонент на смену языка (перерисовка) и возвращает текущий.
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
