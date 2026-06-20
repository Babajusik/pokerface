import { SMILE_CONFIG } from "@pokerface/shared";

// Клиентский детектор улыбки. Делает ТОЛЬКО антидребезг (N кадров подряд выше
// порога) и шлёт серверу одно событие "улыбка". Карточки/кулдаун/вылеты —
// решает сервер (ARCHITECTURE.md §1). Здесь же лёгкий клиентский кулдаун,
// чтобы не спамить сервер во время приступа смеха.
//
// Логика портирована из prototype/smile-engine.js и работает одинаково на
// web (MediaPipe) и native (ML Kit) — меняется только источник сэмплов.

export interface DetectorConfig {
  smileThreshold: number;
  smileFramesToTrigger: number;
  clientCooldownMs: number;
}

const DEFAULTS: DetectorConfig = {
  smileThreshold: SMILE_CONFIG.smileThreshold,
  smileFramesToTrigger: SMILE_CONFIG.smileFramesToTrigger,
  clientCooldownMs: 1500,
};

export class SmileDetector {
  config: DetectorConfig;
  private consecutive = 0;
  private lastFiredAt = 0;

  constructor(cfg: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULTS, ...cfg };
  }

  reset() {
    this.consecutive = 0;
    this.lastFiredAt = 0;
  }

  /**
   * Скормить один сэмпл. Возвращает true, если в этот момент засчитана улыбка
   * (тогда вызывающий код шлёт серверу smile_detected).
   */
  push(smileProbability: number, faceVisible: boolean, ts: number): boolean {
    if (!faceVisible) {
      this.consecutive = 0;
      return false;
    }
    if (smileProbability >= this.config.smileThreshold) {
      this.consecutive++;
      if (this.consecutive >= this.config.smileFramesToTrigger) {
        this.consecutive = 0;
        if (ts - this.lastFiredAt >= this.config.clientCooldownMs) {
          this.lastFiredAt = ts;
          return true;
        }
      }
    } else {
      this.consecutive = 0;
    }
    return false;
  }
}
