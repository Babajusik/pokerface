// Бот-клиенты для теста на ПК без телефонов и камер.
// Подключает N ботов в одну комнату, host стартует игру, дальше боты
// случайно "улыбаются", пока не останется победитель.
//
// Запуск:  npm run bots            (4 бота)
//          BOTS=6 npm run bots     (6 ботов)

import { Client, Room } from "colyseus.js";
import { ClientMsg, ServerMsg, Phase } from "@pokerface/shared";

const ENDPOINT = process.env.ENDPOINT || "ws://localhost:2567";
const NUM_BOTS = Number(process.env.BOTS || 4);
const SMILE_CHANCE = 0.18;     // шанс улыбнуться за тик
const TICK_MS = 700;           // как часто бот "проверяет лицо"

async function spawnBot(index: number) {
  const name = `Bot-${index + 1}`;
  const client = new Client(ENDPOINT);
  const room: Room = await client.joinOrCreate("game", { name });
  let smiling: NodeJS.Timeout | undefined;
  let eliminated = false;

  room.send(ClientMsg.SetReady, { ready: true });
  room.send(ClientMsg.MediaReady, { ready: true }); // у ботов «камеры/микрофон» условно есть

  // host (первый бот) запускает игру, когда все подключились
  if (index === 0) {
    setTimeout(() => {
      console.log(`[${name}] (host) запускаю игру`);
      room.send(ClientMsg.StartGame);
    }, 1500);
  }

  room.onMessage(ServerMsg.PhaseChanged, ({ phase }: { phase: string }) => {
    if (index === 0) console.log(`--- фаза: ${phase} ---`);
    if (phase === Phase.Playing && !smiling) {
      smiling = setInterval(() => {
        if (eliminated) return;
        if (Math.random() < SMILE_CHANCE) {
          room.send(ClientMsg.SmileDetected, { confidence: 0.9, ts: Date.now() });
        }
      }, TICK_MS);
    }
  });

  room.onMessage(ServerMsg.CardIssued, (m: { playerId: string; color: string; cards: number }) => {
    if (m.playerId === room.sessionId) {
      console.log(`[${name}] получил ${m.color} (${m.cards}/2)`);
    }
  });

  room.onMessage(ServerMsg.PlayerEliminated, ({ playerId }: { playerId: string }) => {
    if (playerId === room.sessionId) {
      eliminated = true;
      if (smiling) clearInterval(smiling);
      console.log(`[${name}] ВЫЛЕТЕЛ`);
    }
  });

  room.onMessage(ServerMsg.GameOver, ({ winnerId }: { winnerId: string }) => {
    if (smiling) clearInterval(smiling);
    const iWon = winnerId === room.sessionId;
    if (index === 0) {
      console.log(`\n=== GAME OVER === Победитель: ${winnerId || "никто"}`);
      setTimeout(() => process.exit(0), 800);
    }
    if (iWon) console.log(`[${name}] 🏆 Я ПОБЕДИЛ!`);
  });

  return room;
}

async function main() {
  console.log(`Подключаю ${NUM_BOTS} ботов к ${ENDPOINT} ...`);
  for (let i = 0; i < NUM_BOTS; i++) {
    await spawnBot(i);
    await new Promise((r) => setTimeout(r, 150)); // лёгкая пауза между подключениями
  }
}

main().catch((e) => {
  console.error("Ошибка бота:", e);
  process.exit(1);
});
