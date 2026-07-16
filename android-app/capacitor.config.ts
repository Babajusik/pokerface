import type { CapacitorConfig } from '@capacitor/cli';

// Android-обёртка загружает живую веб-версию (как Tauri на Windows): тогда
// window.location = origin нашего сервера и весь сетевой код работает без
// изменений. Сервер переехал с Render на свой VPS (в РФ: нет холодного старта,
// ниже пинг).
const config: CapacitorConfig = {
  appId: 'com.pokerface.game',
  appName: 'PokerFace',
  webDir: 'www',
  server: {
    url: 'https://pokerface-app.duckdns.org',
    cleartext: false,
  },
};

export default config;
