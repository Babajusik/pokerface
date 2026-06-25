import { SMILE_CONFIG } from "@pokerface/shared";

// Локальные настройки игрока (web: localStorage). Имя, чувствительность улыбки, звук.
export interface Settings {
  name: string;
  smileThreshold: number;
  smileFrames: number;
  sound: boolean;
  voice: boolean;
}

const KEY = "pokerface.settings";
const DEFAULTS: Settings = {
  name: "",
  smileThreshold: SMILE_CONFIG.smileThreshold,
  smileFrames: SMILE_CONFIG.smileFramesToTrigger,
  sound: true,
  voice: true,
};

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(KEY);
      if (raw) cache = { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  if (!cache) cache = { ...DEFAULTS };
  return cache;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch };
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  return cache;
}
