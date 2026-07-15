import type { CapacitorConfig } from '@capacitor/cli';

// Android-обёртка загружает живую веб-версию (как Tauri на Windows): тогда
// window.location = origin Render и весь сетевой код работает без изменений.
const config: CapacitorConfig = {
  appId: 'com.pokerface.game',
  appName: 'PokerFace',
  webDir: 'www',
  server: {
    url: 'https://pokerface-ge2s.onrender.com',
    cleartext: false,
  },
};

export default config;
