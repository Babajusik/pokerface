// Друзья PokerFace — крошечный HTTP-сервис (Node, без зависимостей), крутится на
// VPS рядом с LiveKit/GIF-прокси. Вся логика — в friends-store.js (покрыта тестами);
// здесь только HTTP-обвязка + персистентность JSON. Клиент ходит на /api/* через Caddy.
//
// ENV: PORT (8791), DATA_FILE (/data/friends.json). Запуск: node friends-server.js
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createStore } = require("./friends-store");

const PORT = parseInt(process.env.PORT || "8791", 10);
const DATA_FILE = process.env.DATA_FILE || "/data/friends.json";

// Дебаунс-запись всей базы в JSON (атомарно через tmp+rename).
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(store.dump()));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error("save failed:", e.message); }
  }, 400);
}

const store = createStore({ onChange: scheduleSave });
try { store.load(JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))); } catch { /* первый запуск */ }

function send(res, code, obj) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(obj));
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
    if (req.method === "POST" && p === "/api/register") {
      const { nickname } = await readBody(req);
      return send(res, 200, store.register(nickname));
    }
    if (req.method === "POST" && p === "/api/me") {
      const { id, nickname, avatar } = await readBody(req);
      const prof = store.me(id, { nickname, avatar });
      return prof ? send(res, 200, prof) : send(res, 404, { error: "unknown" });
    }
    if (req.method === "POST" && p === "/api/stats") {
      const { id, result } = await readBody(req);
      const prof = store.stats(id, result);
      return prof ? send(res, 200, prof) : send(res, 404, { error: "unknown" });
    }
    if (req.method === "POST" && p === "/api/ping") {
      const { id } = await readBody(req);
      store.ping(id);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && p === "/api/friends/add") {
      const { id, code } = await readBody(req);
      const status = store.addFriend(id, code);
      return status === "unknown" ? send(res, 404, { error: "unknown" }) : send(res, 200, { status });
    }
    if (req.method === "GET" && p === "/api/friends") {
      return send(res, 200, store.list(url.searchParams.get("id")));
    }
    if (req.method === "POST" && p === "/api/friends/respond") {
      const { id, from, accept } = await readBody(req);
      return send(res, 200, { ok: store.respond(id, from, accept) });
    }
    if (req.method === "POST" && p === "/api/friends/remove") {
      const { id, friend } = await readBody(req);
      store.remove(id, friend);
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && p === "/api/invite") {
      const { from, to, room, lobby } = await readBody(req);
      const r = store.invite(from, to, room, lobby);
      if (r === "unknown") return send(res, 404, { error: "unknown" });
      if (r === "notfriends") return send(res, 403, { error: "not friends" });
      if (r === "noroom") return send(res, 400, { error: "no room" });
      return send(res, 200, { ok: true });
    }
    if (req.method === "GET" && p === "/api/invites") {
      return send(res, 200, { invites: store.listInvites(url.searchParams.get("id")) });
    }
    if (req.method === "POST" && p === "/api/invite/clear") {
      const { id, from } = await readBody(req);
      store.clearInvite(id, from);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`friends-server on :${PORT}, data=${DATA_FILE}`));
