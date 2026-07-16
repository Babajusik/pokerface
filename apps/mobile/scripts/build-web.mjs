// Сборка веб-версии со штампом версии + PWA-теги.
// Версия (git SHA) попадает в ТРИ места, чтобы работала авто-проверка обновлений:
//   1) в клиентский бандл  — EXPO_PUBLIC_BUILD_VERSION (клиент знает "свою" версию),
//   2) в /version.json     — что сейчас на сервере (клиент сравнивает с собой),
//   3) в имя кэша SW       — новый деплой => новый кэш, старый чистится сам.
// Expo (SDK 56) сам PWA-теги в index.html не кладёт — дописываем здесь же.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";

const OUT = "../../server/game/public";
const INDEX = `${OUT}/index.html`;
const SW = `${OUT}/pwa-sw.js`;

// --- версия сборки ---
let version;
try {
  version = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  version = Date.now().toString(36); // не git-репозиторий — берём метку времени
}
console.log(`build-web: версия ${version}`);

// --- сборка Expo с прокинутой версией ---
const res = spawnSync(
  "npx",
  ["expo", "export", "-p", "web", "--output-dir", OUT],
  { stdio: "inherit", shell: true, env: { ...process.env, EXPO_PUBLIC_BUILD_VERSION: version } }
);
if (res.status !== 0) process.exit(res.status ?? 1);

// --- version.json: источник правды «что сейчас на сервере» ---
writeFileSync(`${OUT}/version.json`, JSON.stringify({ version, builtAt: new Date().toISOString() }));

// --- штампуем версию в кэш service worker'а ---
if (existsSync(SW)) {
  const sw = readFileSync(SW, "utf8").replace(/pokerface-v1/g, `pokerface-${version}`);
  writeFileSync(SW, sw);
}

// --- PWA-теги в index.html ---
if (!existsSync(INDEX)) {
  console.error("build-web: нет", INDEX);
  process.exit(1);
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
if (!html.includes("/manifest.json")) { html = html.replace("</head>", headTags + "\n  </head>"); changed = true; }
if (!html.includes("/pwa-sw.js")) { html = html.replace("</body>", swReg + "\n  </body>"); changed = true; }
if (changed) writeFileSync(INDEX, html);

console.log(`build-web: готово — version.json, SW-кэш pokerface-${version}, PWA-теги ${changed ? "добавлены" : "уже были"}`);
