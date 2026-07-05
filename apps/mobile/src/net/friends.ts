// Друзья — лёгкий социальный слой. Личность анонимная: при первом обращении
// сервер выдаёт постоянный id + короткий «код друга», храним в localStorage.
// Данные лежат на нашем VPS (сервис friends-server.js + SQLite/JSON), клиент
// ходит напрямую через тот же домен, что и GIF-прокси — работает из РФ без VPN.
// Игровой сервер (Colyseus/Render) в этом не участвует.

const API = (process.env.EXPO_PUBLIC_FRIENDS_API as string) || "https://pokerface-lk.duckdns.org/api";
const KEY = "pokerface.friend";

export interface Identity { id: string; code: string; nickname: string }
export interface Friend { id: string; code: string; nickname: string }
export interface FriendsData { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] }

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
      const id = { id: me.id, code: me.code, nickname: me.nickname };
      store(id);
      return id;
    } catch (e: any) {
      // id неизвестен серверу (сброшена база) → регистрируемся заново
      if (!String(e.message).includes("404")) throw e;
    }
  }
  const r = await post("/register", { nickname });
  const id = { id: r.id, code: r.code, nickname: r.nickname };
  store(id);
  return id;
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
