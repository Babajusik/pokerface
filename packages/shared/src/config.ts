// Конфиг игры — единый для сервера и приложения.
// Значения детекта улыбки подобраны на браузерном прототипе (prototype/).

export const SMILE_CONFIG = {
  smileThreshold: 0.4,       // порог вероятности улыбки [0..1]
  smileFramesToTrigger: 5,   // кадров подряд выше порога = улыбка (детект на клиенте)
} as const;

export const BLINK_CONFIG = {
  blinkThreshold: 0.5,       // порог вероятности закрытого глаза [0..1]
  blinkFramesToTrigger: 2,   // моргание короче улыбки — хватает 2 кадров подряд
} as const;

export const FREEZE_CONFIG = {
  clipRecordMs: 2500,        // сколько писать клип пойманного игрока после паузы
} as const;

export const GAME_CONFIG = {
  maxCards: 2,               // 2-я карточка (красная) = вылет
  cardCooldownMs: 2500,      // нельзя получить 2 карточки за один смех
  faceLostGraceMs: 4000,     // сколько можно прятать лицо до штрафа
  countdownMs: 3000,         // отсчёт перед началом раунда
  minPlayersToStart: 2,      // минимум игроков для старта
} as const;
