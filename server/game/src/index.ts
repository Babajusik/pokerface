import "dotenv/config";
import http from "http";
import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom";
import { hasLiveKit, createToken, liveKitUrl } from "./services/livekit";

const port = Number(process.env.PORT) || 2567;

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

// Веб-панель для наблюдения за комнатами: /monitor
app.use("/monitor", monitor());

// Список публичных лобби.
app.get("/rooms", async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: "game", private: false });
    res.json(
      rooms.map((r) => ({
        roomId: r.roomId,
        lobbyName: r.metadata?.lobbyName || "Лобби",
        phase: r.metadata?.phase || "lobby",
        clients: r.clients,
        maxClients: r.maxClients,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "ошибка" });
  }
});

// Поиск комнаты по коду (для приватных лобби).
app.get("/rooms/by-code", async (req, res) => {
  const code = String(req.query.code || "").toUpperCase().trim();
  if (!code) return res.status(400).json({ error: "нужен код" });
  const rooms = await matchMaker.query({ name: "game" });
  const r = rooms.find((x) => (x.metadata?.code || "") === code);
  if (!r) return res.status(404).json({ error: "лобби с таким кодом не найдено" });
  res.json({ roomId: r.roomId, lobbyName: r.metadata?.lobbyName || "Лобби" });
});

// Токен для входа в LiveKit-комнату (видео). identity = sessionId игрока.
app.get("/livekit-token", async (req, res) => {
  if (!hasLiveKit()) {
    return res.status(503).json({ error: "LiveKit не настроен (см. server/game/.env)" });
  }
  const room = String(req.query.room || "");
  const identity = String(req.query.identity || "");
  const name = String(req.query.name || identity);
  if (!room || !identity) {
    return res.status(400).json({ error: "нужны параметры room и identity" });
  }
  try {
    const token = await createToken(room, identity, name);
    res.json({ token, url: liveKitUrl() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "ошибка генерации токена" });
  }
});

// Раздача собранного веб-приложения (npm run build:web кладёт его в ./public).
// Если сборки нет (dev) — отдаём простую заглушку на "/".
const publicDir = path.join(__dirname, "..", "public");
const hasWebBuild = fs.existsSync(path.join(publicDir, "index.html"));
if (hasWebBuild) {
  app.use(express.static(publicDir));
  // SPA-fallback: всё, что не API/не статика, отдаёт index.html
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  console.log("  Веб-приложение: раздаётся из ./public");
} else {
  app.get("/", (_req, res) => res.send("PokerFace game server OK (web build отсутствует)"));
}

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom);

httpServer.listen(port, () => {
  console.log(`\n  PokerFace game server:  ws://localhost:${port}`);
  console.log(`  Monitor:                http://localhost:${port}/monitor\n`);
});
