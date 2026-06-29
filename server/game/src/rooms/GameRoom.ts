import { Room, Client } from "colyseus";
import { GameState, Player } from "../schema/GameState";
import {
  GAME_CONFIG, Phase, ClientMsg, ServerMsg,
  pickJoke, HostLevel, JokeCtx,
  ITEMS, ItemId, ITEM_COOLDOWN_MS, randomMeme, randomSticker,
} from "@pokerface/shared";

// Авторитарная игровая комната. Клиент шлёт только "я улыбнулся" —
// карточки, вылеты и победителя решает сервер (см. ARCHITECTURE.md §1).
interface CreateOptions {
  lobbyName?: string;
  isPrivate?: boolean;
  maxPlayers?: number;
  code?: string;
  hostLevel?: HostLevel;
}

// Допустимые id предметов — для валидации входящих UseItem.
const VALID_ITEM_IDS = new Set<string>(ITEMS.map((it) => it.id));
// Лёгкий анти-флуд: не больше N сообщений в окне на клиента.
const MSG_RATE_MAX = 25;
const MSG_RATE_WINDOW_MS = 1000;

export class GameRoom extends Room<GameState> {
  maxClients = 16;
  code = "";
  hostLevel: HostLevel = "normal";
  private startedAt = 0;
  private tauntTimer?: any;
  private itemState = new Map<string, { lastAt: number; uses: Record<string, number> }>();
  private msgRate = new Map<string, number[]>();

  onCreate(options: CreateOptions = {}) {
    this.setState(new GameState());
    this.state.lobbyName = (options.lobbyName || "Лобби").slice(0, 24);
    this.maxClients = Math.min(Math.max(options.maxPlayers || 8, 2), 16);
    this.state.maxPlayers = this.maxClients;
    this.code = options.code || Math.random().toString(36).slice(2, 8).toUpperCase();
    this.state.code = this.code;
    this.hostLevel = options.hostLevel || "normal";
    if (options.isPrivate) this.setPrivate(true);
    this.syncMetadata();

    this.onMessage(ClientMsg.SetReady, (client, msg: { ready?: boolean }) => {
      if (this.rateLimited(client)) return;
      if (typeof msg?.ready !== "boolean") return; // валидация формы
      const p = this.state.players.get(client.sessionId);
      if (p && this.state.phase === Phase.Lobby) p.ready = msg.ready;
    });

    this.onMessage(ClientMsg.StartGame, (client) => {
      if (this.rateLimited(client)) return;
      this.tryStart(client);
    });
    this.onMessage(ClientMsg.Rematch, (client) => {
      if (this.rateLimited(client)) return;
      this.rematch();
    });
    this.onMessage(ClientMsg.SmileDetected, (client) => {
      if (this.rateLimited(client)) return;
      this.handleSmile(client);
    });
    this.onMessage(ClientMsg.UseItem, (client, msg: { itemId?: ItemId; targetId?: string }) => {
      if (this.rateLimited(client)) return;
      if (!msg || !VALID_ITEM_IDS.has(msg.itemId as string)) return; // неизвестный предмет
      if (typeof msg.targetId !== "string" || !msg.targetId) return;
      this.handleUseItem(client, { itemId: msg.itemId as ItemId, targetId: msg.targetId });
    });

    this.onMessage(ClientMsg.FaceLost, (client) => {
      if (this.rateLimited(client)) return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.faceVisible = false;
    });
    this.onMessage(ClientMsg.FaceFound, (client) => {
      if (this.rateLimited(client)) return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.faceVisible = true;
    });

    this.onMessage(ClientMsg.MediaReady, (client, msg: { ready?: boolean }) => {
      if (this.rateLimited(client)) return;
      if (typeof msg?.ready !== "boolean") return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.mediaReady = msg.ready;
    });
  }

  // Скользящее окно: true = клиент превысил лимит сообщений, игнорируем.
  private rateLimited(client: Client): boolean {
    const now = Date.now();
    const arr = (this.msgRate.get(client.sessionId) || []).filter(
      (t) => now - t < MSG_RATE_WINDOW_MS
    );
    arr.push(now);
    this.msgRate.set(client.sessionId, arr);
    return arr.length > MSG_RATE_MAX;
  }

  onJoin(client: Client, options: { name?: string }) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = options?.name || `Player-${client.sessionId.slice(0, 4)}`;
    this.state.players.set(client.sessionId, p);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[room ${this.roomId}] +${p.name} (${this.state.players.size} в комнате)`);
  }

  async onLeave(client: Client, consented?: boolean) {
    this.msgRate.delete(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    const inMatch =
      this.state.phase === Phase.Countdown || this.state.phase === Phase.Playing;

    // Намеренный выход или мы не в матче → удаляем сразу.
    if (consented || !inMatch || !p) {
      this.removePlayer(client.sessionId);
      return;
    }

    // Обрыв связи в матче: держим место 30 сек, помечаем "переподключается".
    p.connected = false;
    console.log(`[room ${this.roomId}] обрыв ${p.name}, ждём реконнект...`);
    try {
      await this.allowReconnection(client, 30);
      const back = this.state.players.get(client.sessionId);
      if (back) back.connected = true;
      console.log(`[room ${this.roomId}] ${p.name} переподключился`);
    } catch {
      console.log(`[room ${this.roomId}] ${p.name} не вернулся, удаляем`);
      this.removePlayer(client.sessionId);
    }
  }

  private removePlayer(sessionId: string) {
    this.state.players.delete(sessionId);
    this.msgRate.delete(sessionId);
    if (this.state.hostId === sessionId) {
      this.state.hostId = [...this.state.players.keys()][0] || "";
    }
    if (this.state.phase === Phase.Playing) this.checkWinner();
  }

  private setPhase(phase: Phase) {
    this.state.phase = phase;
    if (phase !== Phase.Playing) this.stopTaunts();
    // Лобби открыто для входа; как только начался отсчёт/игра — комната закрыта.
    if (phase === Phase.Lobby) this.unlock();
    else this.lock();
    this.broadcast(ServerMsg.PhaseChanged, { phase });
    this.syncMetadata();
    console.log(`[room ${this.roomId}] фаза -> ${phase}`);
  }

  private syncMetadata() {
    this.setMetadata({
      lobbyName: this.state.lobbyName,
      code: this.code,
      phase: this.state.phase,
    });
  }

  // ── ИИ-ведущий: выбираем готовую реплику (0 токенов) и шлём всем ──
  private taunt(ctx: JokeCtx, name = "") {
    const tmpl = pickJoke(ctx, this.hostLevel);
    if (!tmpl) return;
    const text = tmpl.replace(/\{name\}/g, name || this.randomAliveName());
    this.state.tauntText = text;
    this.broadcast(ServerMsg.Taunt, { text });
  }
  private randomAliveName(): string {
    const alive = [...this.state.players.values()].filter((p) => !p.eliminated);
    return alive.length ? alive[Math.floor(Math.random() * alive.length)].name : "кто-нибудь";
  }
  private stopTaunts() {
    if (this.tauntTimer) {
      this.tauntTimer.clear();
      this.tauntTimer = undefined;
    }
  }

  private tryStart(client: Client) {
    if (client.sessionId !== this.state.hostId) return; // только host
    if (this.state.phase !== Phase.Lobby) return;
    if (this.state.players.size < GAME_CONFIG.minPlayersToStart) return;
    // Старт только когда у всех подключены камера и микрофон.
    if (![...this.state.players.values()].every((p) => p.mediaReady)) return;

    this.setPhase(Phase.Countdown);
    this.clock.setTimeout(() => this.beginRound(), GAME_CONFIG.countdownMs);
  }

  private beginRound() {
    this.startedAt = Date.now();
    this.state.roundStartedAt = this.startedAt;
    for (const p of this.state.players.values()) {
      p.cards = 0;
      p.eliminated = false;
      p.survivedMs = 0;
      p.lastCardAt = 0;
    }
    this.state.winnerId = "";
    this.resetItems();
    this.setPhase(Phase.Playing);
    this.taunt("hype");
    this.tauntTimer = this.clock.setInterval(() => this.taunt("hype"), 9000);
  }

  private resetItems() {
    this.itemState.clear();
    for (const id of this.state.players.keys()) {
      const uses: Record<string, number> = {};
      for (const it of ITEMS) uses[it.id] = it.charges;
      this.itemState.set(id, { lastAt: 0, uses });
    }
  }

  private handleUseItem(client: Client, msg: { itemId: ItemId; targetId: string }) {
    if (this.state.phase !== Phase.Playing) return;
    const from = this.state.players.get(client.sessionId);
    const target = this.state.players.get(msg?.targetId);
    if (!from || from.eliminated) return;
    if (!target || target.eliminated || target.id === from.id) return;
    const st = this.itemState.get(from.id);
    if (!st) return;
    const now = Date.now();
    if (now - st.lastAt < ITEM_COOLDOWN_MS) return;
    if (!st.uses[msg.itemId] || st.uses[msg.itemId] <= 0) return;
    st.uses[msg.itemId] -= 1;
    st.lastAt = now;

    if (msg.itemId === "host") {
      this.taunt("hype", target.name); // натравили ведущего на жертву
      return;
    }
    const payload: any = { itemId: msg.itemId, fromName: from.name, targetId: target.id };
    if (msg.itemId === "meme") payload.text = randomMeme();
    if (msg.itemId === "sticker") payload.sticker = randomSticker();
    this.broadcast(ServerMsg.ItemUsed, payload);
  }

  private rematch() {
    if (this.state.phase !== Phase.GameOver) return;
    for (const p of this.state.players.values()) {
      p.cards = 0;
      p.eliminated = false;
      p.ready = false;
      p.survivedMs = 0;
      p.lastCardAt = 0;
    }
    this.state.winnerId = "";
    this.setPhase(Phase.Lobby);
  }

  private handleSmile(client: Client) {
    if (this.state.phase !== Phase.Playing) return;
    const p = this.state.players.get(client.sessionId);
    if (!p || p.eliminated) return;

    const now = Date.now();
    if (now - p.lastCardAt < GAME_CONFIG.cardCooldownMs) return; // кулдаун
    p.lastCardAt = now;
    p.cards += 1;

    const color = p.cards >= GAME_CONFIG.maxCards ? "red" : "yellow";
    this.broadcast(ServerMsg.CardIssued, { playerId: p.id, cards: p.cards, color });
    console.log(`[room ${this.roomId}] ${p.name}: ${color} (${p.cards}/${GAME_CONFIG.maxCards})`);

    if (p.cards >= GAME_CONFIG.maxCards) {
      p.eliminated = true;
      p.survivedMs = now - this.startedAt;
      this.broadcast(ServerMsg.PlayerEliminated, { playerId: p.id });
      this.taunt("out", p.name);
      const alive = [...this.state.players.values()].filter((x) => !x.eliminated);
      if (alive.length === 2) this.taunt("duel");
      this.checkWinner();
    } else {
      this.taunt("card", p.name);
    }
  }

  private checkWinner() {
    if (this.state.phase !== Phase.Playing) return;
    const alive = [...this.state.players.values()].filter((p) => !p.eliminated);
    if (alive.length <= 1) {
      this.state.winnerId = alive[0]?.id || "";
      this.setPhase(Phase.GameOver);
      const name = alive[0]?.name || "никто";
      this.broadcast(ServerMsg.GameOver, { winnerId: this.state.winnerId });
      if (alive[0]) this.taunt("win", name);
      console.log(`[room ${this.roomId}] 🏆 Победитель: ${name}`);
    }
  }
}
