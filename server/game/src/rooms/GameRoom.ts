import { Room, Client } from "colyseus";
import { GameState, Player } from "../schema/GameState";
import { GAME_CONFIG, Phase, ClientMsg, ServerMsg } from "@pokerface/shared";

// Авторитарная игровая комната. Клиент шлёт только "я улыбнулся" —
// карточки, вылеты и победителя решает сервер (см. ARCHITECTURE.md §1).
interface CreateOptions {
  lobbyName?: string;
  isPrivate?: boolean;
  maxPlayers?: number;
  code?: string;
}

export class GameRoom extends Room<GameState> {
  maxClients = 16;
  code = "";
  private startedAt = 0;

  onCreate(options: CreateOptions = {}) {
    this.setState(new GameState());
    this.state.lobbyName = (options.lobbyName || "Лобби").slice(0, 24);
    this.maxClients = Math.min(Math.max(options.maxPlayers || 8, 2), 16);
    this.code = options.code || Math.random().toString(36).slice(2, 8).toUpperCase();
    this.state.code = this.code;
    if (options.isPrivate) this.setPrivate(true);
    this.syncMetadata();

    this.onMessage(ClientMsg.SetReady, (client, msg: { ready: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (p && this.state.phase === Phase.Lobby) p.ready = !!msg?.ready;
    });

    this.onMessage(ClientMsg.StartGame, (client) => this.tryStart(client));
    this.onMessage(ClientMsg.Rematch, () => this.rematch());
    this.onMessage(ClientMsg.SmileDetected, (client) => this.handleSmile(client));

    this.onMessage(ClientMsg.FaceLost, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.faceVisible = false;
    });
    this.onMessage(ClientMsg.FaceFound, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.faceVisible = true;
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = options?.name || `Player-${client.sessionId.slice(0, 4)}`;
    this.state.players.set(client.sessionId, p);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[room ${this.roomId}] +${p.name} (${this.state.players.size} в комнате)`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) {
      this.state.hostId = [...this.state.players.keys()][0] || "";
    }
    if (this.state.phase === Phase.Playing) this.checkWinner();
  }

  private setPhase(phase: Phase) {
    this.state.phase = phase;
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

  private tryStart(client: Client) {
    if (client.sessionId !== this.state.hostId) return; // только host
    if (this.state.phase !== Phase.Lobby) return;
    if (this.state.players.size < GAME_CONFIG.minPlayersToStart) return;

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
    this.setPhase(Phase.Playing);
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
      this.checkWinner();
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
      console.log(`[room ${this.roomId}] 🏆 Победитель: ${name}`);
    }
  }
}
