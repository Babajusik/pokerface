// Друзья PokerFace — крошечный сервис (Node, без зависимостей), крутится на VPS
// рядом с LiveKit/GIF-прокси. Хранилище — JSON-файл (для нашего масштаба хватает;
// при росте легко заменить на SQLite). Клиент ходит на /api/* через Caddy.
//
// ENV: PORT (по умолчанию 8791), DATA_FILE (по умолчанию /data/friends.json).
// Запуск: node friends-server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "8791", 10);
const DATA_FILE = process.env.DATA_FILE || "/data/friends.json";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I
const NICK_MAX = 24;
const ONLINE_MS = 45000;    // «в сети», если пинг был за последние 45с
const INVITE_TTL = 120000;  // приглашение живёт 2 минуты

// --- хранилище -------------------------------------------------------------
// users[id]   = { id, code, nickname, created }
// codeIndex[code] = id
// requests[`${from}|${to}`] = ts      (направленная заявка)
// friends[`${a}|${b}`] = ts           (a<b — неориентированная дружба)
let db = { users: {}, requests: {}, friends: {} };
const codeIndex = {};
// Эфемерное (в памяти, не пишем в JSON):
const seen = {};    // seen[id] = ts последнего пинга (онлайн)
const invites = {}; // invites[`${to}|${from}`] = { room, lobby, ts }

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    db = { users: parsed.users || {}, requests: parsed.requests || {}, friends: parsed.friends || {} };
  } catch { /* первый запуск — пустая база */ }
  for (const id in db.users) codeIndex[db.users[id].code] = id;
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error("save failed:", e.message); }
  }, 400);
}

// --- утилиты ---------------------------------------------------------------
function genCode() {
  let code;
  do {
    code = "";
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  } while (codeIndex[code]);
  return code;
}
function cleanNick(s) { return String(s || "").trim().slice(0, NICK_MAX); }
function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function isOnline(id) { return !!seen[id] && Date.now() - seen[id] < ONLINE_MS; }
function pub(id) { const u = db.users[id]; return u ? { id: u.id, code: u.code, nickname: u.nickname, avatar: u.avatar || "", played: u.played || 0, wins: u.wins || 0, online: isOnline(u.id) } : null; }
function areFriends(a, b) { return !!db.friends[pairKey(a, b)]; }
function pruneInvites() { const now = Date.now(); for (const k in invites) if (now - invites[k].ts > INVITE_TTL) delete invites[k]; }

function friendsOf(id) {
  const out = [];
  for (const k in db.friends) {
    const [a, b] = k.split("|");
    if (a === id) out.push(b); else if (b === id) out.push(a);
  }
  return out.map(pub).filter(Boolean);
}
function incomingOf(id) {
  const out = [];
  for (const k in db.requests) { const [from, to] = k.split("|"); if (to === id) out.push(from); }
  return out.map(pub).filter(Boolean);
}
function outgoingOf(id) {
  const out = [];
  for (const k in db.requests) { const [from, to] = k.split("|"); if (from === id) out.push(to); }
  return out.map(pub).filter(Boolean);
}

// --- HTTP ------------------------------------------------------------------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "");

  try {
    // POST /api/register {nickname} -> {id, code, nickname}
    if (req.method === "POST" && p === "/api/register") {
      const { nickname } = await readBody(req);
      const id = crypto.randomUUID();
      const code = genCode();
      db.users[id] = { id, code, nickname: cleanNick(nickname), avatar: "", played: 0, wins: 0, created: Date.now() };
      codeIndex[code] = id;
      save();
      return send(res, 200, pub(id));
    }

    // POST /api/me {id, nickname?, avatar?} -> профиль | 404
    // Без nickname/avatar просто возвращает текущий профиль (played/wins/online).
    if (req.method === "POST" && p === "/api/me") {
      const { id, nickname, avatar } = await readBody(req);
      if (!db.users[id]) return send(res, 404, { error: "unknown" });
      if (nickname !== undefined) db.users[id].nickname = cleanNick(nickname);
      if (typeof avatar === "string") db.users[id].avatar = avatar.slice(0, 8);
      save();
      return send(res, 200, pub(id));
    }

    // POST /api/stats {id, result} -> профиль  (result: "win" | "loss")
    if (req.method === "POST" && p === "/api/stats") {
      const { id, result } = await readBody(req);
      const u = db.users[id];
      if (!u) return send(res, 404, { error: "unknown" });
      u.played = (u.played || 0) + 1;
      if (result === "win") u.wins = (u.wins || 0) + 1;
      save();
      return send(res, 200, pub(id));
    }

    // POST /api/ping {id} -> {ok}  (онлайн-статус, в памяти)
    if (req.method === "POST" && p === "/api/ping") {
      const { id } = await readBody(req);
      if (db.users[id]) seen[id] = Date.now();
      return send(res, 200, { ok: true });
    }

    // POST /api/friends/add {id, code} -> {status}
    if (req.method === "POST" && p === "/api/friends/add") {
      const { id, code } = await readBody(req);
      if (!db.users[id]) return send(res, 404, { error: "unknown" });
      const targetId = codeIndex[String(code || "").trim().toUpperCase()];
      if (!targetId) return send(res, 200, { status: "notfound" });
      if (targetId === id) return send(res, 200, { status: "self" });
      if (areFriends(id, targetId)) return send(res, 200, { status: "already" });
      const reverse = `${targetId}|${id}`;
      if (db.requests[reverse]) {
        // встречная заявка уже есть → сразу друзья
        delete db.requests[reverse];
        delete db.requests[`${id}|${targetId}`];
        db.friends[pairKey(id, targetId)] = Date.now();
        save();
        return send(res, 200, { status: "friends" });
      }
      if (db.requests[`${id}|${targetId}`]) return send(res, 200, { status: "already" });
      db.requests[`${id}|${targetId}`] = Date.now();
      save();
      return send(res, 200, { status: "requested" });
    }

    // GET /api/friends?id= -> {friends, incoming, outgoing}
    if (req.method === "GET" && p === "/api/friends") {
      const id = url.searchParams.get("id");
      if (!id || !db.users[id]) return send(res, 200, { friends: [], incoming: [], outgoing: [] });
      return send(res, 200, { friends: friendsOf(id), incoming: incomingOf(id), outgoing: outgoingOf(id) });
    }

    // POST /api/friends/respond {id, from, accept} -> {ok}
    if (req.method === "POST" && p === "/api/friends/respond") {
      const { id, from, accept } = await readBody(req);
      const key = `${from}|${id}`;
      if (!db.requests[key]) return send(res, 200, { ok: false });
      delete db.requests[key];
      if (accept && db.users[id] && db.users[from]) db.friends[pairKey(id, from)] = Date.now();
      save();
      return send(res, 200, { ok: true });
    }

    // POST /api/friends/remove {id, friend} -> {ok}
    if (req.method === "POST" && p === "/api/friends/remove") {
      const { id, friend } = await readBody(req);
      delete db.friends[pairKey(id, friend)];
      delete db.requests[`${id}|${friend}`];
      delete db.requests[`${friend}|${id}`];
      save();
      return send(res, 200, { ok: true });
    }

    // POST /api/invite {from, to, room, lobby} -> {ok}  (позвать друга в лобби)
    if (req.method === "POST" && p === "/api/invite") {
      const { from, to, room, lobby } = await readBody(req);
      if (!db.users[from] || !db.users[to]) return send(res, 404, { error: "unknown" });
      if (!areFriends(from, to)) return send(res, 403, { error: "not friends" });
      if (!room) return send(res, 400, { error: "no room" });
      invites[`${to}|${from}`] = { room: String(room), lobby: cleanNick(lobby), ts: Date.now() };
      return send(res, 200, { ok: true });
    }

    // GET /api/invites?id= -> {invites:[{from, nickname, room, lobby}]}
    if (req.method === "GET" && p === "/api/invites") {
      pruneInvites();
      const id = url.searchParams.get("id");
      const out = [];
      if (id && db.users[id]) {
        for (const k in invites) {
          const [to, from] = k.split("|");
          if (to !== id || !db.users[from]) continue;
          out.push({ from, nickname: db.users[from].nickname, room: invites[k].room, lobby: invites[k].lobby });
        }
      }
      return send(res, 200, { invites: out });
    }

    // POST /api/invite/clear {id, from} -> {ok}
    if (req.method === "POST" && p === "/api/invite/clear") {
      const { id, from } = await readBody(req);
      delete invites[`${id}|${from}`];
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

load();
server.listen(PORT, () => console.log(`friends-server on :${PORT}, data=${DATA_FILE}`));
