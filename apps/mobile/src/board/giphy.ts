// Поиск гифок (как в Instagram) через НАШ прокси на VPS — он в РФ, достаётся
// без VPN, и сам ходит к GIPHY с серверным ключом (ключ не в клиентском бандле).
// Прокси: https://pokerface-lk.duckdns.org/gif?q=... → отдаёт ответ GIPHY.

const PROXY = (process.env.EXPO_PUBLIC_GIF_PROXY as string) || "https://pokerface-lk.duckdns.org/gif";

export function hasGiphy(): boolean {
  return !!PROXY;
}

export interface GifResult {
  id: string;
  thumb: string; // маленькое превью для грида
  url: string;   // сама гифка для вставки на доску
}

export async function searchGifs(q: string): Promise<GifResult[]> {
  if (!q.trim()) return [];
  try {
    const res = await fetch(`${PROXY}?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    return (json.data || [])
      .map((g: any) => ({
        id: g.id,
        thumb: g.images?.fixed_width_small?.url || g.images?.preview_gif?.url || "",
        url: g.images?.fixed_width?.url || g.images?.downsized?.url || "",
      }))
      .filter((g: GifResult) => g.url && g.thumb);
  } catch {
    return [];
  }
}
