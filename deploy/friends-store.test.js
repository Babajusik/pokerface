"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createStore } = require("./friends-store");

// Управляемые часы: clock.t можно двигать для тестов онлайна/TTL.
function makeStore(extra = {}) {
  const clock = { t: 1000 };
  let changes = 0;
  const store = createStore({ now: () => clock.t, onChange: () => changes++, ...extra });
  return { store, clock, changes: () => changes };
}

test("register: возвращает профиль по умолчанию", () => {
  const { store } = makeStore();
  const u = store.register("Alice");
  assert.match(u.id, /[0-9a-f-]{36}/);
  assert.equal(u.code.length, 6);
  assert.equal(u.nickname, "Alice");
  assert.deepEqual({ avatar: u.avatar, played: u.played, wins: u.wins, online: u.online }, { avatar: "", played: 0, wins: 0, online: false });
});

test("me: неизвестный id → null; известный — правит ник/аватар", () => {
  const { store } = makeStore();
  assert.equal(store.me("нет"), null);
  const a = store.register("A");
  const upd = store.me(a.id, { nickname: "Anna", avatar: "🦊" });
  assert.equal(upd.nickname, "Anna");
  assert.equal(upd.avatar, "🦊");
  // без патча — просто чтение, ник не сбрасывается
  assert.equal(store.me(a.id).nickname, "Anna");
});

test("stats: инкремент игр и побед; неизвестный → null", () => {
  const { store } = makeStore();
  assert.equal(store.stats("нет", "win"), null);
  const a = store.register("A");
  store.stats(a.id, "win");
  store.stats(a.id, "loss");
  const p = store.stats(a.id, "win");
  assert.equal(p.played, 3);
  assert.equal(p.wins, 2);
});

test("ping/online: в сети внутри окна, оффлайн после", () => {
  const { store, clock } = makeStore({ onlineMs: 45000 });
  const a = store.register("A");
  const b = store.register("B");
  // подружим, чтобы видеть онлайн в списке
  store.addFriend(a.id, b.code);
  store.respond(b.id, a.id, true);
  assert.equal(store.list(b.id).friends[0].online, false);
  store.ping(a.id);
  assert.equal(store.list(b.id).friends[0].online, true);
  clock.t += 46000; // окно прошло
  assert.equal(store.list(b.id).friends[0].online, false);
  assert.equal(store.ping("нет"), false);
});

test("addFriend: полная машина состояний", () => {
  const { store } = makeStore();
  const a = store.register("A");
  const b = store.register("B");
  assert.equal(store.addFriend("нет", b.code), "unknown");
  assert.equal(store.addFriend(a.id, "ZZZZZZ"), "notfound");
  assert.equal(store.addFriend(a.id, a.code), "self");
  assert.equal(store.addFriend(a.id, b.code), "requested");
  assert.equal(store.addFriend(a.id, b.code), "already"); // повторная заявка
});

test("addFriend: встречная заявка → сразу друзья", () => {
  const { store } = makeStore();
  const a = store.register("A");
  const b = store.register("B");
  assert.equal(store.addFriend(a.id, b.code), "requested");
  assert.equal(store.addFriend(b.id, a.code), "friends"); // встречная
  assert.equal(store.addFriend(a.id, b.code), "already"); // уже друзья
  // заявок не осталось, дружба видна с обеих сторон
  assert.equal(store.list(a.id).friends[0].id, b.id);
  assert.equal(store.list(b.id).friends[0].id, a.id);
  assert.equal(store.list(a.id).incoming.length + store.list(a.id).outgoing.length, 0);
});

test("respond: приём создаёт дружбу, отклонение — нет; на пустую заявку false", () => {
  const { store } = makeStore();
  const a = store.register("A");
  const b = store.register("B");
  const c = store.register("C");
  store.addFriend(a.id, b.code); // A→B
  assert.equal(store.respond(b.id, a.id, true), true);
  assert.equal(store.list(a.id).friends[0].id, b.id);
  // отклонение
  store.addFriend(a.id, c.code); // A→C
  assert.equal(store.respond(c.id, a.id, false), true);
  assert.equal(store.list(c.id).friends.length, 0);
  assert.equal(store.list(a.id).outgoing.length, 0);
  // повторный ответ на несуществующую заявку
  assert.equal(store.respond(b.id, a.id, true), false);
});

test("list: incoming/outgoing/friends раскладываются верно", () => {
  const { store } = makeStore();
  const a = store.register("A");
  const b = store.register("B");
  const c = store.register("C");
  store.addFriend(a.id, b.code); // A→B (outgoing у A, incoming у B)
  store.addFriend(c.id, a.code); // C→A (incoming у A, outgoing у C)
  const la = store.list(a.id);
  assert.deepEqual(la.outgoing.map((x) => x.id), [b.id]);
  assert.deepEqual(la.incoming.map((x) => x.id), [c.id]);
  assert.equal(la.friends.length, 0);
  assert.deepEqual(store.list("нет"), { friends: [], incoming: [], outgoing: [] });
});

test("remove: удаляет дружбу и висящие заявки в обе стороны", () => {
  const { store } = makeStore();
  const a = store.register("A");
  const b = store.register("B");
  store.addFriend(a.id, b.code);
  store.respond(b.id, a.id, true);
  store.remove(a.id, b.id);
  assert.equal(store.list(a.id).friends.length, 0);
  assert.equal(store.list(b.id).friends.length, 0);
});

test("invite: только между друзьями, с комнатой; иначе коды ошибок", () => {
  const { store } = makeStore();
  const a = store.register("A");
  const b = store.register("B");
  assert.equal(store.invite(a.id, "нет", "R1", "Party"), "unknown");
  assert.equal(store.invite(a.id, b.id, "R1", "Party"), "notfriends");
  store.addFriend(a.id, b.code); store.respond(b.id, a.id, true);
  assert.equal(store.invite(a.id, b.id, "", "Party"), "noroom");
  assert.equal(store.invite(a.id, b.id, "R1", "Party"), "ok");
  const inv = store.listInvites(b.id);
  assert.equal(inv.length, 1);
  assert.deepEqual({ from: inv[0].from, room: inv[0].room, lobby: inv[0].lobby }, { from: a.id, room: "R1", lobby: "Party" });
});

test("invite: TTL истекает; clearInvite сбрасывает", () => {
  const { store, clock } = makeStore({ inviteTtl: 120000 });
  const a = store.register("A");
  const b = store.register("B");
  store.addFriend(a.id, b.code); store.respond(b.id, a.id, true);
  store.invite(a.id, b.id, "R1", "L");
  assert.equal(store.listInvites(b.id).length, 1);
  clock.t += 121000; // TTL прошёл
  assert.equal(store.listInvites(b.id).length, 0);
  // clear
  store.invite(a.id, b.id, "R2", "L");
  store.clearInvite(b.id, a.id);
  assert.equal(store.listInvites(b.id).length, 0);
});

test("load/dump: восстановление базы и поиск по коду работают", () => {
  const src = makeStore().store;
  const a = src.register("A");
  const b = src.register("B");
  src.addFriend(a.id, b.code);
  src.respond(b.id, a.id, true);
  const snapshot = JSON.parse(JSON.stringify(src.dump()));

  const dst = makeStore().store;
  dst.load(snapshot);
  // дружба восстановилась
  assert.equal(dst.list(a.id).friends[0].id, b.id);
  // codeIndex перестроен: добавление по коду находит игрока
  const c = dst.register("C");
  assert.equal(dst.addFriend(c.id, a.code), "requested");
});

test("onChange: дёргается на мутациях, но не на ping/чтении", () => {
  const { store, changes } = makeStore();
  const before = changes();
  const a = store.register("A"); // +1
  store.list(a.id);              // чтение — 0
  store.ping(a.id);              // эфемерно — 0
  assert.equal(changes() - before, 1);
});
