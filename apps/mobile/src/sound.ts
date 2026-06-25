// Простые звуки через Web Audio (web). На native — no-op (можно позже expo-av).
import { getSettings } from "./settings";
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function beep(freq: number, durMs: number, type: OscillatorType = "sine", gain = 0.06, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + durMs / 1000);
}

export type SoundType = "tick" | "go" | "yellow" | "red" | "win" | "lose";

// Гэг-звук для предмета «Звук» (рандомный прикол).
export function playGag() {
  if (!getSettings().sound) return;
  const r = Math.floor(Math.random() * 3);
  if (r === 0) {
    // дудка
    beep(330, 600, "sawtooth", 0.12); beep(330, 600, "sawtooth", 0.12, 0.05);
  } else if (r === 1) {
    // грустный тромбон
    [392, 370, 349, 330].forEach((f, i) => beep(f, 280, "sine", 0.1, i * 0.22));
  } else {
    // boing
    beep(600, 120, "triangle", 0.12); beep(300, 220, "triangle", 0.12, 0.1);
  }
}

export function playSound(s: SoundType) {
  if (!getSettings().sound) return;
  switch (s) {
    case "tick": beep(660, 120, "square", 0.05); break;
    case "go": beep(880, 250, "square", 0.07); break;
    case "yellow": beep(440, 180, "sawtooth", 0.07); break;
    case "red": beep(180, 400, "sawtooth", 0.09); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => beep(f, 220, "triangle", 0.07, i * 0.13)); break;
    case "lose": beep(200, 500, "sine", 0.08); beep(150, 600, "sine", 0.08, 0.15); break;
  }
}
