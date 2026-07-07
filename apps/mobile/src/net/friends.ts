// Друзья — лёгкий социальный слой. Личность анонимная: при первом обращении
// сервер выдаёт постоянный id + короткий «код друга», храним в localStorage.
// Данные лежат на нашем VPS (сервис friends-server.js + SQLite/JSON), клиент
// ходит напрямую через тот же домен, что и GIF-прокси — работает из РФ без VPN.
// Игровой сервер (Colyseus/Render) в этом не участвует.

const API = (process.env.EXPO_PUBLIC_FRIENDS_API as string) || "https://pokerface-lk.duckdns.org/api";
const KEY = "pokerface.friend";

export interface Identity { id: string; code: string; nickname: string; avatar?: string }
export interface Friend { id: string; code: string; nickname: string; online?: boolean; avatar?: string; played?: number; wins?: number }
export interface FriendsData { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] }
export interface Invite { from: string; nickname: string; room: string; lobby: string }

let cache: Identity | null = null;

function load(): Identity | null {
  if (cache) return cache;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(KEY);
      if (raw) cache = JSON.parse(raw);
    }
  } catch {}
  return cache;
}

function store(id: Identity) {
  cache = id;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(id));
  } catch {}
}

export function getIdentity(): Identity | null {
  return load();
}

async function post(path: string, body: any): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

// Регистрирует игрока (или синхронизирует ник). Вызывать при входе на экран
// друзей — nickname берём из имени в меню.
export async function ensureRegistered(nickname: string): Promise<Identity> {
  const cur = load();
  if (cur?.id) {
    try {
      const me = await post("/me", { id: cur.id, nickname });
      const id = { id: me.id, code: me.code, nickname: me.nickname, avatar: me.avatar };
      store(id);
      return id;
    } catch (e: any) {
      // id неизвестен серверу (сброшена база) → регистрируемся заново
      if (!String(e.message).includes("404")) throw e;
    }
  }
  const r = await post("/register", { nickname });
  const id = { id: r.id, code: r.code, nickname: r.nickname, avatar: r.avatar };
  store(id);
  return id;
}

// Мой профиль со свежими статами (played/wins/avatar/online). {id} без ника
// не меняет ник — просто читает.
export async function getMyProfile(): Promise<Friend | null> {
  const me = load();
  if (!me) return null;
  try { return await post("/me", { id: me.id }); } catch { return null; }
}

export async function setAvatar(avatar: string): Promise<void> {
  const me = load();
  if (!me) return;
  try {
    await post("/me", { id: me.id, avatar });
    store({ ...me, avatar });
  } catch {}
}

// Записать результат матча (для статистики профиля). Fire-and-forget.
export async function reportMatch(win: boolean): Promise<void> {
  const me = load();
  if (!me) return;
  try { await post("/stats", { id: me.id, result: win ? "win" : "loss" }); } catch {}
}

export type AddResult = "requested" | "friends" | "self" | "notfound" | "already";

export async function addFriend(code: string): Promise<AddResult> {
  const me = load();
  if (!me) throw new Error("no identity");
  const r = await post("/friends/add", { id: me.id, code: code.trim().toUpperCase() });
  return r.status as AddResult;
}

export async function listFriends(): Promise<FriendsData> {
  const me = load();
  if (!me) return { friends: [], incoming: [], outgoing: [] };
  const res = await fetch(`${API}/friends?id=${encodeURIComponent(me.id)}`);
  if (!res.ok) throw new Error(`list ${res.status}`);
  const d = await res.json();
  return {
    friends: d.friends || [],
    incoming: d.incoming || [],
    outgoing: d.outgoing || [],
  };
}

export async function respondRequest(fromId: string, accept: boolean): Promise<void> {
  const me = load();
  if (!me) return;
  await post("/friends/respond", { id: me.id, from: fromId, accept });
}

export async function removeFriend(friendId: string): Promise<void> {
  const me = load();
  if (!me) return;
  await post("/friends/remove", { id: me.id, friend: friendId });
}

// Онлайн-пинг: держим статус «в сети», пока приложение открыто. Fire-and-forget.
export async function ping(): Promise<void> {
  const me = load();
  if (!me) return;
  try { await post("/ping", { id: me.id }); } catch {}
}

// Пригласить друга в текущее лобби (передаём roomId + название).
export async function sendInvite(toId: string, room: string, lobby: string): Promise<void> {
  const me = load();
  if (!me) return;
  await post("/invite", { from: me.id, to: toId, room, lobby });
}

// Мои входящие приглашения (эфемерные, живут ~2 мин).
export async function listInvites(): Promise<Invite[]> {
  const me = load();
  if (!me) return [];
  try {
    const res = await fetch(`${API}/invites?id=${encodeURIComponent(me.id)}`);
    if (!res.ok) return [];
    const d = await res.json();
    return d.invites || [];
  } catch { return []; }
}

export async function clearInvite(fromId: string): Promise<void> {
  const me = load();
  if (!me) return;
  try { await post("/invite/clear", { id: me.id, from: fromId }); } catch {}
}
