// smile-engine.js
//
// Портируемое ядро игры «не улыбнись». НЕ зависит от MediaPipe, камеры или DOM.
// На вход — поток "сэмплов" (вероятность улыбки + видно ли лицо + таймстамп).
// На выход — события игры (улыбка засчитана, выдана карточка, вылет).
//
// Этот же модуль будет переиспользован в мобильном приложении: там вместо
// MediaPipe сэмплы будет давать ML Kit / MediaPipe Tasks, но логика та же.

/** Конфиг игры. Совпадает с packages/shared/config из ARCHITECTURE.md. */
export const DEFAULT_CONFIG = {
  smileThreshold: 0.4,       // порог вероятности улыбки [0..1] (подобрано на тесте)
  smileFramesToTrigger: 5,   // сколько сэмплов подряд выше порога = улыбка (подобрано)
  cardCooldownMs: 2500,      // нельзя получить 2 карточки за один смех
  faceLostGraceMs: 4000,     // сколько можно прятать лицо до штрафа
  maxCards: 2,               // 2-я карточка (красная) = вылет
};

/**
 * SmileEngine — конечный автомат одного игрока.
 * Скармливай ему сэмплы через pushSample(); он вернёт массив событий.
 *
 * Типы событий:
 *   { type: 'smile' }                       — улыбка засчитана (после антидребезга)
 *   { type: 'card', cards: 1|2, color }     — выдана жёлтая/красная карточка
 *   { type: 'eliminated' }                  — игрок вылетел (красная карточка)
 *   { type: 'face_lost' } / { type: 'face_found' }
 *   { type: 'face_penalty' }                — штраф за спрятанное лицо
 */
export class SmileEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reset();
  }

  reset() {
    this.cards = 0;
    this.eliminated = false;
    this.consecutiveAboveThreshold = 0;
    this.lastCardAt = 0;
    this.faceVisible = true;
    this.faceLostSince = null;
    this.facePenaltyIssued = false;
    this.lastSmileProbability = 0;
  }

  /**
   * @param {object} sample
   * @param {number} sample.smileProbability  [0..1]
   * @param {boolean} sample.faceVisible
   * @param {number} sample.ts                таймстамп, мс (performance.now())
   * @returns {Array<object>} события за этот сэмпл
   */
  pushSample({ smileProbability, faceVisible, ts }) {
    const events = [];
    this.lastSmileProbability = smileProbability;

    if (this.eliminated) return events; // вылетел — больше не реагируем

    // --- Отслеживание лица (анти-чит) ---
    if (faceVisible !== this.faceVisible) {
      this.faceVisible = faceVisible;
      if (faceVisible) {
        this.faceLostSince = null;
        this.facePenaltyIssued = false;
        events.push({ type: 'face_found', ts });
      } else {
        this.faceLostSince = ts;
        events.push({ type: 'face_lost', ts });
      }
    }
    if (!faceVisible && this.faceLostSince != null && !this.facePenaltyIssued) {
      if (ts - this.faceLostSince >= this.config.faceLostGraceMs) {
        this.facePenaltyIssued = true;
        events.push({ type: 'face_penalty', ts });
        // штраф трактуем как улыбку — лицо прятать нельзя
        this._registerSmile(events, ts);
      }
    }

    // Нет лица — вероятность улыбки не считаем
    if (!faceVisible) {
      this.consecutiveAboveThreshold = 0;
      return events;
    }

    // --- Антидребезг улыбки: N сэмплов подряд выше порога ---
    if (smileProbability >= this.config.smileThreshold) {
      this.consecutiveAboveThreshold++;
      if (this.consecutiveAboveThreshold >= this.config.smileFramesToTrigger) {
        this._registerSmile(events, ts);
        this.consecutiveAboveThreshold = 0; // сброс, дальше держит кулдаун
      }
    } else {
      this.consecutiveAboveThreshold = 0;
    }

    return events;
  }

  /** Засчитать улыбку с учётом кулдауна между карточками. */
  _registerSmile(events, ts) {
    if (ts - this.lastCardAt < this.config.cardCooldownMs) return; // ещё кулдаун
    this.lastCardAt = ts;
    this.cards++;
    events.push({ type: 'smile', ts });
    const color = this.cards >= this.config.maxCards ? 'red' : 'yellow';
    events.push({ type: 'card', cards: this.cards, color, ts });
    if (this.cards >= this.config.maxCards) {
      this.eliminated = true;
      events.push({ type: 'eliminated', ts });
    }
  }
}
