import { Schema, MapSchema, type } from "@colyseus/schema";

// Синхронизируемое состояние комнаты. Colyseus автоматически реплицирует
// все @type-поля всем клиентам. Поля без @type — серверные, не синкаются.
export class Player extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("uint8") cards = 0;              // 0 = чисто, 1 = жёлтая, 2 = красная
  @type("boolean") eliminated = false;
  @type("boolean") faceVisible = true;
  @type("boolean") ready = false;
  @type("boolean") connected = true;     // false = обрыв связи, держим место (реконнект)
  @type("uint32") survivedMs = 0;

  // серверное (не синкается):
  lastCardAt = 0;
}

export class GameState extends Schema {
  @type("string") phase = "lobby";
  @type("string") lobbyName = "";
  @type("string") code = "";
  @type("uint8") maxPlayers = 8;
  @type("string") hostId = "";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("uint32") roundStartedAt = 0;
  @type("string") winnerId = "";
  @type("string") tauntText = "";
}
