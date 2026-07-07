# Свой LiveKit на VPS (видео без VPN) — Фаза B

Цель: поднять собственный сервер LiveKit + TURN на VPS, доступном из РФ, и
переключить игру с LiveKit Cloud на него. Код менять почти не нужно — игровой
сервер уже берёт `LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET` из env.

Ключи (API key/secret) уже сгенерированы — спроси у Claude/возьми из локальной
заметки. В этот файл секреты НЕ вписываем (он в git).

---

## 0. Что купить

**VPS (РФ-хостинг — гарантированно доступен из РФ):**
- Timeweb Cloud / Selectel / VK Cloud / Yandex Cloud.
- Минимум: 2 vCPU, 2 GB RAM, Ubuntu 22.04/24.04, **публичный IPv4**.
- Важно: тариф должен разрешать открытые UDP-порты (диапазон 50000–60000).
- Цена: ~250–500 ₽/мес.

**Домен (нужен для TLS-сертификата):**
- Платно: дешёвый `.ru` на reg.ru (~200 ₽/год).
- Бесплатно: поддомен на **DuckDNS** (`что-нибудь.duckdns.org`) — A-запись на IP
  VPS, Let's Encrypt по нему выдаёт сертификат.
- Заведи A-запись: `lk.твойдомен` → IP VPS. (TURN использует тот же домен.)

---

## 1. Подготовка VPS

```bash
ssh root@<IP_VPS>

# Docker + compose
curl -fsSL https://get.docker.com | sh
apt-get update && apt-get install -y docker-compose-plugin
```

**Открой порты** (firewall провайдера И ufw, если включён):

| Порт | Назначение |
|------|------------|
| 443/TCP | HTTPS (signaling, wss) + TURN/TLS |
| 80/TCP | выдача TLS-сертификата (Let's Encrypt) |
| 7881/TCP | WebRTC поверх TCP |
| 3478/UDP | TURN/UDP |
| 50000–60000/UDP | WebRTC поверх UDP (медиа) |

```bash
# пример для ufw
ufw allow 443/tcp && ufw allow 80/tcp && ufw allow 7881/tcp
ufw allow 3478/udp && ufw allow 50000:60000/udp
```

---

## 2. Сгенерировать конфиг LiveKit

На VPS:
```bash
mkdir -p /opt/livekit && cd /opt/livekit
docker pull livekit/generate
docker run --rm -it -v$PWD:/output livekit/generate
```

Генератор спросит:
- **Domain** → `lk.твойдомен` (тот, что в A-записи).
- **API key / secret** → вставь СГЕНЕРИРОВАННЫЕ ключи (key `APP...`, secret).
  Можно дать сгенерировать ему, но тогда используй ЕГО значения и на Render.
- Egress/Ingress → не нужны (нам только видео-сетка), пропускай.

На выходе: `docker-compose.yaml`, `caddy.yaml`, `livekit.yaml`, `redis.conf`,
`init_script.sh`.

---

## 3. Запуск

```bash
cd /opt/livekit
sudo ./init_script.sh        # либо: docker compose up -d
docker compose ps            # все сервисы Up
docker compose logs -f livekit
```

Проверка, что signaling жив (с любого устройства):
```
https://lk.твойдомен/        →  должен ответить (LiveKit OK)
```
TLS-сертификат Caddy выпустит сам за ~1 мин (порт 80 должен быть открыт).

---

## 4. Переключить игру на свой LiveKit

**A) Прод (Render) — Variables игрового сервиса:**
```
LIVEKIT_URL    = wss://lk.твойдомен
LIVEKIT_API_KEY    = <тот же key, что в конфиге VPS>
LIVEKIT_API_SECRET = <тот же secret>
```
Сохранить → Render передеплоит. (Токены подписываются этим секретом локально,
сетевой вызов к VPS не нужен; браузер клиента сам подключается к wss://lk...)

**B) Локально для теста:** `server/game/.env` с теми же 3 значениями, затем
`npm run server`.

---

## 5. Проверка «без VPN»

1. Двое из РФ **без VPN** заходят в одно лобби.
2. Должны увидеть камеры друг друга (баннер «видео выключено» пропадает).
3. Если видео не идёт, но игра работает — смотри `docker compose logs livekit`
   и проверь, что UDP 50000–60000 реально открыты у провайдера (частая причина).

**Готово, когда:** двое из РФ видят камеры без VPN.

---

## GIF-прокси (режим «Доска», GIF-поиск)

На том же VPS/стеке (`/opt/livekit`) крутится крошечный прокси к GIPHY — чтобы
GIF-поиск работал из РФ без VPN и ключ GIPHY не светился в клиенте.

- **`gif-server.js`** — Node http-сервер на порту `8790`. Три ручки (+CORS `*`):
  - `GET /gif?q=...` → прокси к `api.giphy.com` (ключ из env `GIPHY_KEY`).
  - `POST /upload` (сырое тело, `Content-Type` = тип файла) → сохраняет в
    `/data/media`, отдаёт `{url}`. Лимит 25 МБ, принимает image/*, video/*.
  - `GET /media/<file>` → раздаёт загруженные файлы. Тома: `./uploads:/data/media`.
- **docker-compose** — сервис `gifproxy` (`node:20-alpine`, `network_mode: host`,
  env `GIPHY_KEY`, монтирует `gif-server.js`).
- **Caddyfile** — маршрутизация по пути (matcher `@backend path /gif* /upload* /media*`):
  `handle @backend → localhost:8790`, `handle → localhost:7880` (LiveKit).
- Клиент зовёт `https://pokerface-lk.duckdns.org/gif?q=...`
  (можно переопределить env `EXPO_PUBLIC_GIF_PROXY`), парсит ответ GIPHY.
- Порт 8790 наружу открывать НЕ нужно (только Caddy на localhost).
- Обновить конфиг Caddy: `docker compose restart caddy`.

---

## Друзья (API `/api/*`)

На том же VPS/стеке (`/opt/livekit`) крутится сервис друзей — анонимные личности
(id + короткий «код друга»), заявки и список друзей. Клиент ходит на `/api/*`
через Caddy (работает из РФ без VPN, игровой сервер Render не участвует).

- **`friends-server.js`** (версия в репо: `deploy/friends-server.js`) — Node http
  без зависимостей, порт `8791`, хранилище — JSON `/data/friends.json`. Ручки (CORS `*`):
  - `POST /api/register {nickname}` → `{id, code, nickname}` (создаёт игрока).
  - `POST /api/me {id, nickname?, avatar?}` → профиль (played/wins/avatar/online); без ника/аватара просто читает. 404 если id неизвестен.
  - `POST /api/stats {id, result}` → инкремент played (+wins если result="win").
  - `POST /api/friends/add {id, code}` → `{status}` (requested/friends/self/notfound/already).
  - `GET  /api/friends?id=` → `{friends, incoming, outgoing}`.
  - `POST /api/friends/respond {id, from, accept}` → приём/отклонение заявки.
  - `POST /api/friends/remove {id, friend}` → удалить из друзей.
  - `POST /api/ping {id}` → онлайн-статус (хранится в памяти, окно 45с).
  - `POST /api/invite {from, to, room, lobby}` → позвать друга в лобби (в памяти, TTL 2 мин, только между друзьями).
  - `GET  /api/invites?id=` → мои входящие приглашения.
  - `POST /api/invite/clear {id, from}` → сбросить приглашение.
- **docker-compose** — сервис `friendsproxy` (`node:20-alpine`, `network_mode: host`,
  env `PORT=8791`/`DATA_FILE=/data/friends.json`, тома `./friends-server.js:/app/server.js`
  и `./friends-data:/data`).
- **Caddyfile** — matcher `@friends path /api*` → `handle → localhost:8791` (перед `@backend`).
- Клиент: `apps/mobile/src/net/friends.ts` (базу переопределяет env `EXPO_PUBLIC_FRIENDS_API`).
- Порт 8791 наружу открывать НЕ нужно (только Caddy на localhost).
- Обновить: скопировать `friends-server.js`, затем `docker compose up -d friendsproxy`
  и `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`.

---

## Заметки
- Один небольшой VPS тянет несколько лобби (видео идёт через SFU, нагрузка в
  основном на трафик, не на CPU).
- Если домен — DuckDNS, A-запись обновляется их скриптом/URL; Caddy по нему
  всё равно получит сертификат (нужен открытый порт 80).
- Старые ключи LiveKit Cloud после перехода можно отозвать (см. долг в ROADMAP).
