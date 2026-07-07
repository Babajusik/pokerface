import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { ClientMsg, GameMode } from "@pokerface/shared";
import { GameRoom } from "./rooms/GameRoom";

// Интеграционные тесты реальной комнаты Colyseus: проверяем проводку сообщений
// и гейты состояния (что юнит-тесты logic.ts не покрывают). Медленные таймеры
// (отсчёт 3с, кулдаун карт 2.5с) не ждём — проверяем момент перехода в countdown.
describe("GameRoom (интеграция)", () => {
  let colyseus: ColyseusTestServer;

  before(async () => {
    colyseus = await boot({ initializeGameServer: (gs: any) => gs.define("game", GameRoom) });
  });
  after(async () => { await colyseus.shutdown(); });

  // дать серверу обработать отправленные сообщения (ждём пару патчей комнаты)
  const settle = async (room: any) => { await room.waitForNextPatch(); await room.waitForNextPatch(); };

  it("join: первый игрок — хост, второй — обычный", async () => {
    const room = await colyseus.createRoom("game", { lobbyName: "Test", mode: GameMode.Classic });
    const a = await colyseus.connectTo(room, { name: "Alice" });
    const b = await colyseus.connectTo(room, { name: "Bob" });
    await settle(room);
    assert.equal(room.state.players.size, 2);
    assert.equal(room.state.hostId, a.sessionId);
    assert.notEqual(room.state.hostId, b.sessionId);
    await a.leave(); await b.leave();
  });

  it("старт: не-хост не стартует; хост — только когда media у всех", async () => {
    const room = await colyseus.createRoom("game", { mode: GameMode.Classic });
    const a = await colyseus.connectTo(room, { name: "A" });
    const b = await colyseus.connectTo(room, { name: "B" });
    await settle(room);

    b.send(ClientMsg.StartGame);            // не-хост
    await settle(room);
    assert.equal(room.state.phase, "lobby");

    a.send(ClientMsg.StartGame);            // хост, но media не у всех
    await settle(room);
    assert.equal(room.state.phase, "lobby");

    a.send(ClientMsg.MediaReady, { ready: true });
    b.send(ClientMsg.MediaReady, { ready: true });
    await settle(room);
    a.send(ClientMsg.StartGame);            // теперь можно
    await settle(room);
    assert.equal(room.state.phase, "countdown");

    await a.leave(); await b.leave();
  });

  it("режим судьи: назначение судьи (только хост) и гейт старта", async () => {
    const room = await colyseus.createRoom("game", { mode: GameMode.Judge });
    const a = await colyseus.connectTo(room, { name: "Judge" });
    const b = await colyseus.connectTo(room, { name: "B" });
    const c = await colyseus.connectTo(room, { name: "C" });
    await settle(room);
    for (const cl of [a, b, c]) cl.send(ClientMsg.MediaReady, { ready: true });
    await settle(room);

    b.send(ClientMsg.SetJudge, { playerId: b.sessionId }); // не-хост → игнор
    await settle(room);
    assert.equal(room.state.judgeId, "");

    a.send(ClientMsg.StartGame);                            // без судьи — нельзя
    await settle(room);
    assert.equal(room.state.phase, "lobby");

    a.send(ClientMsg.SetJudge, { playerId: a.sessionId });  // хост назначает судью (себя)
    await settle(room);
    assert.equal(room.state.judgeId, a.sessionId);

    a.send(ClientMsg.StartGame);                            // судья + 2 участника → старт
    await settle(room);
    assert.equal(room.state.phase, "countdown");

    await a.leave(); await b.leave(); await c.leave();
  });

  it("выход хоста: игрок удаляется, хост переназначается", async () => {
    const room = await colyseus.createRoom("game", { mode: GameMode.Classic });
    const a = await colyseus.connectTo(room, { name: "A" });
    const b = await colyseus.connectTo(room, { name: "B" });
    await settle(room);
    assert.equal(room.state.hostId, a.sessionId);

    await a.leave();  // намеренный выход хоста в лобби → удаляем сразу
    await settle(room);
    assert.equal(room.state.players.size, 1);
    assert.equal(room.state.hostId, b.sessionId);
    await b.leave();
  });
});
