// Озвучка реплик ведущего через Web Speech API (web). Бесплатно, на устройстве,
// без ключей. На native — no-op (позже expo-speech). Уважает настройку voice.
import { getSettings } from "./settings";

let ruVoice: SpeechSynthesisVoice | null = null;

function refreshVoice() {
  try {
    const voices = window.speechSynthesis.getVoices();
    ruVoice =
      voices.find((v) => v.lang?.toLowerCase().startsWith("ru")) ||
      voices.find((v) => /russian|русск/i.test(v.name)) ||
      null;
  } catch {}
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  refreshVoice();
  window.speechSynthesis.onvoiceschanged = refreshVoice;
}

export function speak(text: string) {
  if (!getSettings().voice) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU";
    if (ruVoice) u.voice = ruVoice;
    u.rate = 1.05;
    u.pitch = 1.05;
    window.speechSynthesis.cancel(); // не накладываем реплики друг на друга
    window.speechSynthesis.speak(u);
  } catch {}
}
