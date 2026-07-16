// Проверка актуальности версии и обновление.
// Как это работает на всех 4 платформах сразу: веб, PWA, Windows (Tauri) и
// Android (Capacitor) — это ОДИН и тот же веб-билд. Нативные обёртки грузят
// живой сайт, поэтому перезагрузка вебвью = обновление приложения.
//
// BUILD_VERSION вшивается при сборке (scripts/build-web.mjs), а /version.json
// лежит рядом с билдом и говорит, что сейчас на сервере. Не совпало → обновляемся.

export const BUILD_VERSION = (process.env.EXPO_PUBLIC_BUILD_VERSION as string) || "dev";

/** В dev (metro) штампа нет — проверки выключены, иначе получим вечный релоад. */
export const versionCheckEnabled = BUILD_VERSION !== "dev";

// Запоминаем версию, на которую уже пытались обновиться. Если после перезагрузки
// сервер всё ещё отдаёт её, а мы всё ещё старые — обновление не сработало,
// и повторять его бессмысленно (иначе петля перезагрузок).
const GUARD_KEY = "pokerface.updateTarget";

function guardGet(): string | null {
  try { return sessionStorage.getItem(GUARD_KEY); } catch { return null; }
}
function guardSet(v: string) {
  try { sessionStorage.setItem(GUARD_KEY, v); } catch {}
}

/** Версия на сервере (origin, откуда загружено приложение). null — не смогли узнать. */
export async function fetchServerVersion(): Promise<string | null> {
  if (!versionCheckEnabled) return null;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d?.version === "string" ? d.version : null;
  } catch {
    return null; // офлайн/сеть — просто не проверяем в этот раз
  }
}

/**
 * Проверить обновление. Возвращает версию с сервера, если она новее нашей,
 * иначе null. `canAutoApply` = false, если на эту версию мы уже пытались
 * обновиться и не вышло (тогда молча не перезагружаемся).
 */
export async function checkUpdate(): Promise<{ version: string; canAutoApply: boolean } | null> {
  const server = await fetchServerVersion();
  if (!server || server === BUILD_VERSION) return null;
  return { version: server, canAutoApply: guardGet() !== server };
}

/** Применить обновление: снести SW и кэши, затем перезагрузиться на свежий билд. */
export async function applyUpdate(target: string): Promise<void> {
  guardSet(target); // защита от петли, если билд всё равно не обновится
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // не смогли почистить — всё равно перезагружаемся, index отдаётся network-first
  }
  if (typeof location !== "undefined") location.reload();
}
