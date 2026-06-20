# Деплой PokerFace (Railway)

Деплоим **один сервис**: Node-сервер раздаёт собранное веб-приложение + держит игру
(WebSocket) и токены LiveKit. Хостинг даёт HTTPS → камера и видео работают у всех.

LiveKit уже в облаке — его деплоить не нужно.

## Шаги (в терминале, в корне проекта `C:\Users\Nick\Big Game`)

### 1. Установить Railway CLI
```bash
npm i -g @railway/cli
```

### 2. Войти (откроется браузер)
```bash
railway login
```

### 3. Создать проект
```bash
railway init
```
Введи имя, например `pokerface`.

### 4. Прописать ключи LiveKit как переменные окружения
Открой проект на https://railway.app → вкладка **Variables** и добавь три переменные
(значения возьми из своего `server/game/.env`):
```
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```
> Не загружай `.env` на хостинг — переменные задаются здесь. PORT Railway подставит сам.

### 5. Задеплоить из текущей папки
```bash
railway up
```
Railway сам выполнит `npm run build` (соберёт веб) и `npm start` (запустит сервер).
Первая сборка идёт несколько минут (ставит зависимости + `expo export`).

### 6. Включить публичный домен
```bash
railway domain
```
Получишь адрес вида `https://pokerface-production.up.railway.app`.
**Это и есть ссылка для тестеров** — открывают на телефоне, разрешают камеру, играют.

## Проверка после деплоя
- Открой домен в браузере — должно загрузиться приложение PokerFace.
- `https://<домен>/livekit-token?room=r&identity=i` → должен вернуть JSON с `token`
  (а не 503). Если 503 — не заданы переменные LiveKit (шаг 4).

## Обновление после изменений в коде
```bash
railway up
```

---

## Альтернативы (если не Railway)
- **Render**: нужен GitHub-репозиторий. Build command `npm run build`, Start command
  `npm start`, переменные LiveKit в Environment. Минус бесплатного тарифа — «засыпание».
- **Fly.io**: `fly launch` (нужен Docker + CLI), переменные через `fly secrets set`.
Конфиг под них подготовлю по запросу.
