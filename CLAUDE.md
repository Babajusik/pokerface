# PokerFace — бриф для Claude Code

Онлайн-игра «не улыбнись» на веб-камерах (как Discord). Улыбнулся → жёлтая карточка,
второй раз → красная и вылет. Побеждает последний с «железным лицом».

Подробности: [ARCHITECTURE.md](ARCHITECTURE.md) · план работ: [ROADMAP.md](ROADMAP.md) · запуск: [README.md](README.md)

## Стек
- Монорепо (npm workspaces): `apps/mobile` (React Native + Expo SDK 56, цель — iOS/Android, сейчас гоняем как Expo Web), `server/game` (Colyseus, авторитарный сервер), `packages/shared` (общие типы/конфиг/банк шуток/предметы).
- Видео: LiveKit Cloud. Детект улыбки: на устройстве (MediaPipe, модель самохостится в `apps/mobile/public/mediapipe`).
- Хостинг: Render (single web service — Node-сервер раздаёт собранный web + игра + токены), автодеплой из ветки `main`.

## Принципы
- Детект улыбки — на клиенте; сервер — авторитарный судья (карточки/вылеты/победитель).
- ИИ-ведущий «0 токенов»: готовый банк шуток в `packages/shared/src/jokes.ts` (уровни off/normal/savage) + озвучка Web Speech API. Никаких LLM-ключей.

## Как запускать (локально)
```
npm install                 # один раз из корня
npm run server              # Colyseus :2567 (+ /monitor)
npm run app                 # Expo Web :8081
npm run bots                # боты для теста матча без камер
```
Прод-сборка: `npm run build:web` → кладёт web в `server/game/public`, сервер его раздаёт.

## Секреты / .env (ВАЖНО)
- `server/game/.env` (ключи LiveKit) — в `.gitignore`, в репозитории НЕТ. Каждый создаёт свой локально (3 переменные: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). На Render заданы в Variables.
- Не коммитить ключи и `.env`.

## Совместная работа
- `git pull` перед работой, маленькие коммиты, `git push`. Крупное — через ветки/PR.
- Push в `main` → Render автоматически передеплоит.

## Готчи окружения
- Видео LiveKit в сетях РФ режется → нужен VPN (план: self-host TURN, Фаза B в ROADMAP).
- Render free «засыпает» ~50с при простое (первый заход медленный).
- Кириллица в web-бандле экранируется как `\uXXXX` — не проверять деплой grep'ом по русским словам.

## Конвенции кода
- TypeScript везде. Экраны — `apps/mobile/src/screens`, сетевой слой — `src/net/useGame.ts`, видео+детект — `src/video/LiveKitVideo.web.tsx`, тема — `src/theme.ts` (палитра «ночное шоу», лайм-акцент).
- Платформенные файлы: `*.web.tsx` (есть) / `*.native.tsx` (заглушки) — Metro подставляет нужный.
