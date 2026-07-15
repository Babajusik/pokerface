// Пост-обработка веб-экспорта: Expo (SDK 56) сам не добавляет PWA-теги, поэтому
// после `expo export` вставляем в index.html ссылку на манифест, iOS-мета и
// регистрацию service worker. Идемпотентно. Запускается из apps/mobile.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const INDEX = "../../server/game/public/index.html";
if (!existsSync(INDEX)) {
  console.error("pwa-inject: не найден", INDEX, "— пропускаю");
  process.exit(0);
}

let html = readFileSync(INDEX, "utf8");

const headTags = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0B0D12" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="PokerFace" />
    <link rel="apple-touch-icon" href="/pwa-icon.png" />`;

const swReg = `
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/pwa-sw.js").catch(function () {});
        });
      }
    </script>`;

let changed = false;
if (!html.includes("/manifest.json")) {
  html = html.replace("</head>", headTags + "\n  </head>");
  changed = true;
}
if (!html.includes("/pwa-sw.js")) {
  html = html.replace("</body>", swReg + "\n  </body>");
  changed = true;
}

if (changed) {
  writeFileSync(INDEX, html);
  console.log("pwa-inject: index.html пропатчен (manifest + iOS meta + SW)");
} else {
  console.log("pwa-inject: теги уже на месте");
}
