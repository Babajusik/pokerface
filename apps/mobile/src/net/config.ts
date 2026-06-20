import { Platform } from "react-native";

// LAN-IP твоего ПК (для теста с реального телефона в одной сети с dev-сервером).
const LAN_IP = "192.168.1.50";

// Базовые адреса сервера.
// - Прод (web раздаётся самим игровым сервером): тот же origin -> wss/https.
// - Dev (expo --web на :8081) и native: явные адреса.
function resolve(): { ws: string; http: string } {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, host, hostname, port, origin } = window.location;
    const isDev = port === "8081"; // metro dev-сервер
    if (!isDev) {
      // приложение отдал сам сервер -> подключаемся на тот же хост
      const ws = (protocol === "https:" ? "wss:" : "ws:") + "//" + host;
      return { ws, http: origin };
    }
    return { ws: "ws://localhost:2567", http: "http://localhost:2567" };
  }
  if (Platform.OS === "web") {
    return { ws: "ws://localhost:2567", http: "http://localhost:2567" };
  }
  return { ws: `ws://${LAN_IP}:2567`, http: `http://${LAN_IP}:2567` };
}

const r = resolve();
export const SERVER_ENDPOINT = r.ws;
export const TOKEN_BASE = r.http;
