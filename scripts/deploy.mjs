// Деплой на VPS одной командой: npm run deploy
//
// Раньше это делал Render автоматически по пушу. Теперь сервер наш, поэтому:
//   1) собираем веб локально (со штампом версии),
//   2) заливаем только сгенерированное (~700 КБ) — модели MediaPipe (22 МБ)
//      уже лежат в репозитории на VPS, гонять их по сети незачем,
//   3) на VPS подтягиваем код (git pull) и перезапускаем игровой сервер.
//
// Переопределяется через env: PF_VPS (user@host), PF_SSH_KEY (путь к ключу).
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const HOST = process.env.PF_VPS || "root@5.129.201.114";
const HOME = process.env.USERPROFILE || process.env.HOME || "";
const SSH_KEY = process.env.PF_SSH_KEY || join(HOME, ".ssh", "pf_deploy_key");
// UserKnownHostsFile=/dev/null — чтобы ssh не спотыкался о кириллицу в пути профиля
const SSH_OPTS = [
  "-i", SSH_KEY,
  "-o", "UserKnownHostsFile=/dev/null",
  "-o", "StrictHostKeyChecking=no",
  "-o", "IdentitiesOnly=yes",
  "-o", "ConnectTimeout=25",
];
// Имя ОТНОСИТЕЛЬНОЕ и рядом с проектом: абсолютный путь вида C:\... GNU tar
// принимает за удалённый хост (двоеточие) и падает.
const TAR = ".pfweb-deploy.tgz";

const step = (n, msg) => console.log(`\n[${n}/4] ${msg}`);
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
  if (r.status !== 0) {
    console.error(`\n✖ упало: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
  return r;
}

// ── 1. сборка веба (штампует версию в бандл, version.json и кэш SW) ──
step(1, "Собираю веб…");
run("npm", ["run", "build:web"], { shell: true });

// ── 2. пакуем без mediapipe ──
step(2, "Пакую билд (без mediapipe)…");
execFileSync("tar", ["-czf", TAR, "--exclude=mediapipe", "-C", "server/game/public", "."]);
const tarBuf = readFileSync(TAR);
console.log(`  архив: ${(tarBuf.length / 1024).toFixed(0)} КБ`);

// ── 3. заливаем ──
step(3, "Заливаю на VPS…");
const up = spawnSync("ssh", [...SSH_OPTS, HOST, "cat > /tmp/pfweb-deploy.tgz"], { input: tarBuf });
if (up.status !== 0) {
  console.error("✖ не смог залить архив:", up.stderr?.toString().slice(0, 300));
  process.exit(1);
}
try { unlinkSync(TAR); } catch {}

// ── 4. раскладываем и перезапускаем ──
step(4, "Обновляю код и перезапускаю сервер…");
const remote = `
set -e
cd /opt/pokerface
git fetch --quiet origin && git reset --hard --quiet origin/main
echo "  код: $(git rev-parse --short HEAD)"

# зависимости сервера — только если менялись package.json/lock
if ! git diff --quiet HEAD@{1} HEAD -- package-lock.json server/game/package.json packages/shared/package.json 2>/dev/null; then
  echo "  зависимости изменились — переустанавливаю"
  docker run --rm -v /opt/pokerface:/app -w /app node:20-alpine \
    npm install --omit=dev --workspace=@pokerface/game-server --ignore-scripts >/dev/null 2>&1
fi

# веб: сгенерированное из архива + модели из репозитория
rm -rf server/game/public && mkdir -p server/game/public
tar -xzf /tmp/pfweb-deploy.tgz -C server/game/public
cp -r apps/mobile/public/mediapipe server/game/public/
rm -f /tmp/pfweb-deploy.tgz
echo "  веб: $(cat server/game/public/version.json)"

cd /opt/livekit && docker compose up -d game >/dev/null 2>&1
sleep 4
docker compose ps --format '{{.Name}} {{.Status}}' | grep game
`;
run("ssh", [...SSH_OPTS, HOST, "bash -s"], { input: remote, stdio: ["pipe", "inherit", "inherit"] });

// ── проверка ──
const check = spawnSync("curl", ["-s", "-m", "20", "https://pokerface-app.duckdns.org/version.json"], { encoding: "utf8" });
console.log(`\n✓ Готово. Сервер отдаёт: ${(check.stdout || "").trim() || "(не смог проверить)"}`);
console.log("  https://pokerface-app.duckdns.org");
