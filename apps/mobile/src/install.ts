// Установка приложения: определение платформы + нативный промпт установки PWA.
//
// ВАЖНО про iOS: Apple не поддерживает beforeinstallprompt — установить PWA
// программно на айфоне НЕЛЬЗЯ. Там только ручное «Поделиться → На экран Домой»,
// поэтому для iOS показываем инструкцию.
// Chrome/Edge (Android и Windows) событие поддерживают → даём кнопку в один клик.
import { useSyncExternalStore } from "react";

// Ссылки на нативные сборки. Хостим на своём VPS (в РФ, без VPN и throttling'а,
// в отличие от GitHub Releases).
const DL_BASE = (process.env.EXPO_PUBLIC_DOWNLOADS as string) || "https://pokerface-lk.duckdns.org/dl";
export const DOWNLOADS = {
  windows: `${DL_BASE}/PokerFace-setup.exe`,
  android: `${DL_BASE}/PokerFace.apk`,
};

export type Platform = "ios" | "android" | "windows" | "other";

function ua(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
}

export function detectPlatform(): Platform {
  const s = ua();
  // iPad на iOS 13+ маскируется под Mac — ловим по тач-поинтам
  const iPadOS =
    typeof navigator !== "undefined" &&
    /Macintosh/.test(s) &&
    (navigator as any).maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(s) || iPadOS) return "ios";
  if (/Android/i.test(s)) return "android";
  if (/Windows/i.test(s)) return "windows";
  return "other";
}

/** Уже запущено как установленное приложение (PWA/обёртка)? */
export function isStandalone(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

// ── Нативный промпт установки (Chrome/Edge) ──
let deferred: any = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault(); // не показываем свой баннер — покажем свою кнопку
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const getSnapshot = () => !!deferred;

/** Доступна ли установка «в один клик» прямо сейчас. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Показать нативный промпт установки. true — пользователь согласился. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  try {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  } catch {
    return false;
  }
}
