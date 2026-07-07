// Чистое хранилище друзей PokerFace — без HTTP и без диска. Фабрика createStore()
// держит своё состояние; время инъектируется (opts.now) для детерминных тестов
// онлайна/TTL, персистентность — через колбэк opts.onChange (сервер сам пишет JSON).
// Используется friends-server.js; покрыто friends-store.test.js.
"use strict";
const crypto = require("crypto");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I
const NICK_MAX = 24;

function createStore(opts = {}) {
  const now = opts.now || (() => Date.now());
  const ONLINE_MS = opts.onlineMs ?? 45000;   // «в сети», если пинг за последние 45с
  const INVITE_TTL = opts.inviteTtl ?? 120000; // приглашение живёт 2 минуты
  const onChange = opts.onChange || (() => {}); // дёргается при изменении persist-данных

  // users[id] = {id, code, nickname, avatar, played, wins, created}
  // requests[`${from}|${to}`] = ts   ; friends[`${a}|${b}`] = ts (a<b)
  let db = { users: {}, requests: {}, friends: {} };
  const codeIndex = {};
  const seen = {};    // seen[id] = ts последнего пинга (эфемерно)
  const invites = {}; // invites[`${to}|${from}`] = {room, lobby, ts} (эфемерно)

  const cleanNick = (s) => String(s || "").trim().slice(0, NICK_MAX);
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const isOnline = (id) => !!seen[id] && now() - seen[id] < ONLINE_MS;
  const areFriends = (a, b) => !!db.friends[pairKey(a, b)];
  const pub = (id) => {
    const u = db.users[id];
    return u ? { id: u.id, code: u.code, nickname: u.nickname, avatar: u.avatar || "", played: u.played || 0, wins: u.wins || 0, online: isOnline(u.id) } : null;
  };
  function genCode() {
    let code;
    do {
      code = "";
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    } while (codeIndex[code]);
    return code;
  }
  function pruneInvites() { const t = now(); for (const k in invites) if (t - invites[k].ts > INVITE_TTL) delete invites[k]; }
  const others = (id, map) => {
    const out = [];
    for (const k in map) { const [a, b] = k.split("|"); if (a === id) out.push(b); else if (b === id) out.push(a); }
    return out;
  };

  return {
    load(data) {
      db = { users: (data && data.users) || {}, requests: (data && data.requests) || {}, friends: (data && data.friends) || {} };
      for (const k in codeIndex) delete codeIndex[k];
      for (const id in db.users) codeIndex[db.users[id].code] = id;
    },
    dump() { return db; },

    register(nickname) {
      const id = crypto.randomUUID();
      const code = genCode();
      db.users[id] = { id, code, nickname: cleanNick(nickname), avatar: "", played: 0, wins: 0, created: now() };
      codeIndex[code] = id;
      onChange();
      return pub(id);
    },

    me(id, patch = {}) {
      if (!db.users[id]) return null;
      if (patch.nickname !== undefined) db.users[id].nickname = cleanNick(patch.nickname);
      if (typeof patch.avatar === "string") db.users[id].avatar = patch.avatar.slice(0, 8);
      onChange();
      return pub(id);
    },

    stats(id, result) {
      const u = db.users[id];
      if (!u) return null;
      u.played = (u.played || 0) + 1;
      if (result === "win") u.wins = (u.wins || 0) + 1;
      onChange();
      return pub(id);
    },

    ping(id) { if (db.users[id]) { seen[id] = now(); return true; } return false; },

    // "unknown" | "notfound" | "self" | "already" | "friends" | "requested"
    addFriend(id, code) {
      if (!db.users[id]) return "unknown";
      const targetId = codeIndex[String(code || "").trim().toUpperCase()];
      if (!targetId) return "notfound";
      if (targetId === id) return "self";
      if (areFriends(id, targetId)) return "already";
      const reverse = `${targetId}|${id}`;
      if (db.requests[reverse]) { // встречная заявка → сразу друзья
        delete db.requests[reverse];
        delete db.requests[`${id}|${targetId}`];
        db.friends[pairKey(id, targetId)] = now();
        onChange();
        return "friends";
      }
      if (db.requests[`${id}|${targetId}`]) return "already";
      db.requests[`${id}|${targetId}`] = now();
      onChange();
      return "requested";
    },

    respond(id, from, accept) {
      const key = `${from}|${id}`;
      if (!db.requests[key]) return false;
      delete db.requests[key];
      if (accept && db.users[id] && db.users[from]) db.friends[pairKey(id, from)] = now();
      onChange();
      return true;
    },

    remove(id, friend) {
      delete db.friends[pairKey(id, friend)];
      delete db.requests[`${id}|${friend}`];
      delete db.requests[`${friend}|${id}`];
      onChange();
      return true;
    },

    list(id) {
      if (!id || !db.users[id]) return { friends: [], incoming: [], outgoing: [] };
      const incoming = [];
      const outgoing = [];
      for (const k in db.requests) { const [from, to] = k.split("|"); if (to === id) incoming.push(from); else if (from === id) outgoing.push(to); }
      return {
        friends: others(id, db.friends).map(pub).filter(Boolean),
        incoming: incoming.map(pub).filter(Boolean),
        outgoing: outgoing.map(pub).filter(Boolean),
      };
    },

    // "unknown" | "notfriends" | "noroom" | "ok"
    invite(from, to, room, lobby) {
      if (!db.users[from] || !db.users[to]) return "unknown";
      if (!areFriends(from, to)) return "notfriends";
      if (!room) return "noroom";
      invites[`${to}|${from}`] = { room: String(room), lobby: cleanNick(lobby), ts: now() };
      return "ok";
    },

    listInvites(id) {
      pruneInvites();
      const out = [];
      if (id && db.users[id]) {
        for (const k in invites) {
          const [to, from] = k.split("|");
          if (to !== id || !db.users[from]) continue;
          out.push({ from, nickname: db.users[from].nickname, room: invites[k].room, lobby: invites[k].lobby });
        }
      }
      return out;
    },

    clearInvite(id, from) { delete invites[`${id}|${from}`]; return true; },
  };
}

module.exports = { createStore };
