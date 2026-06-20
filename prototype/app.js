// app.js
//
// Обвязка прототипа: веб-камера + MediaPipe Face Landmarker -> SmileEngine -> UI.
// Это "одноразовый" слой для тестирования на ПК. В мобильную версию переедет
// только smile-engine.js; здесь же MediaPipe заменится на ML Kit / VisionCamera.

import { FaceLandmarker, FilesetResolver } from
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12";
import { SmileEngine, DEFAULT_CONFIG } from "./smile-engine.js";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm";

// --- DOM ---
const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const meterFill = document.getElementById("meterFill");
const meterValue = document.getElementById("meterValue");
const thresholdLine = document.getElementById("thresholdLine");
const cardsEl = document.getElementById("cards");
const faceStateEl = document.getElementById("faceState");
const logEl = document.getElementById("log");

const thresholdInput = document.getElementById("threshold");
const framesInput = document.getElementById("frames");
const cooldownInput = document.getElementById("cooldown");
const thresholdOut = document.getElementById("thresholdOut");
const framesOut = document.getElementById("framesOut");
const cooldownOut = document.getElementById("cooldownOut");

// --- Состояние ---
let faceLandmarker = null;
let running = false;
let lastVideoTime = -1;
let engine = new SmileEngine(readConfig());

function readConfig() {
  return {
    ...DEFAULT_CONFIG,
    smileThreshold: parseFloat(thresholdInput.value),
    smileFramesToTrigger: parseInt(framesInput.value, 10),
    cardCooldownMs: parseInt(cooldownInput.value, 10),
  };
}

function syncConfigUI() {
  thresholdOut.textContent = parseFloat(thresholdInput.value).toFixed(2);
  framesOut.textContent = framesInput.value;
  cooldownOut.textContent = `${cooldownInput.value} мс`;
  thresholdLine.style.left = `${parseFloat(thresholdInput.value) * 100}%`;
}

[thresholdInput, framesInput, cooldownInput].forEach((el) =>
  el.addEventListener("input", () => {
    syncConfigUI();
    engine.config = readConfig(); // меняем пороги на лету, не сбрасывая карточки
  })
);
syncConfigUI();

function log(msg, kind = "info") {
  const line = document.createElement("div");
  line.className = `log-line log-${kind}`;
  const t = new Date().toLocaleTimeString();
  line.textContent = `[${t}] ${msg}`;
  logEl.prepend(line);
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

// --- Загрузка модели ---
async function loadModel() {
  setStatus("Загружаю модель MediaPipe…", "loading");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1,
  });
  setStatus("Модель готова. Включи камеру ▶", "ready");
}

// --- Камера ---
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: 640, height: 480 },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

// --- Извлечение вероятности улыбки из blendshapes ---
function smileProbabilityFrom(result) {
  const shapes = result.faceBlendshapes;
  if (!shapes || shapes.length === 0) return { prob: 0, faceVisible: false };
  const cats = shapes[0].categories;
  let left = 0, right = 0;
  for (const c of cats) {
    if (c.categoryName === "mouthSmileLeft") left = c.score;
    else if (c.categoryName === "mouthSmileRight") right = c.score;
  }
  return { prob: (left + right) / 2, faceVisible: true };
}

// --- Главный цикл ---
function loop() {
  if (!running) return;
  const now = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = faceLandmarker.detectForVideo(video, now);
    const { prob, faceVisible } = smileProbabilityFrom(result);

    updateMeter(prob, faceVisible);
    const events = engine.pushSample({ smileProbability: prob, faceVisible, ts: now });
    for (const ev of events) handleEvent(ev);
  }

  requestAnimationFrame(loop);
}

function updateMeter(prob, faceVisible) {
  const pct = Math.round(prob * 100);
  meterFill.style.width = `${pct}%`;
  meterValue.textContent = faceVisible ? `${pct}%` : "—";
  const over = prob >= engine.config.smileThreshold;
  meterFill.classList.toggle("over", over && faceVisible);
  faceStateEl.textContent = faceVisible ? "🙂 лицо в кадре" : "🚫 лица нет";
  faceStateEl.className = `face-state ${faceVisible ? "" : "lost"}`;
}

function renderCards(cards) {
  cardsEl.innerHTML = "";
  const labels = [
    { n: 1, color: "yellow", txt: "🟨 Жёлтая" },
    { n: 2, color: "red", txt: "🟥 Красная" },
  ];
  for (const l of labels) {
    const el = document.createElement("div");
    el.className = `card-badge ${cards >= l.n ? l.color : "empty"}`;
    el.textContent = cards >= l.n ? l.txt : "—";
    cardsEl.appendChild(el);
  }
}
renderCards(0);

function handleEvent(ev) {
  switch (ev.type) {
    case "smile":
      log("Улыбка засчитана!", "warn");
      break;
    case "card":
      renderCards(ev.cards);
      log(`Выдана ${ev.color === "red" ? "КРАСНАЯ" : "жёлтая"} карточка (${ev.cards}/2)`,
        ev.color === "red" ? "danger" : "warn");
      break;
    case "eliminated":
      log("ВЫЛЕТ! Игрок выбыл из игры.", "danger");
      setStatus("🟥 Ты вылетел! Нажми «Сброс» для нового раунда.", "eliminated");
      running = false;
      break;
    case "face_lost":
      log("Лицо пропало из кадра", "warn");
      break;
    case "face_found":
      log("Лицо снова в кадре", "info");
      break;
    case "face_penalty":
      log("Штраф: лицо спрятано слишком долго (анти-чит)", "danger");
      break;
  }
}

// --- Кнопки ---
startBtn.addEventListener("click", async () => {
  try {
    startBtn.disabled = true;
    if (!faceLandmarker) await loadModel();
    setStatus("Запрашиваю доступ к камере…", "loading");
    await startCamera();
    running = true;
    lastVideoTime = -1;
    setStatus("🎥 Идёт детект. Не улыбайся!", "playing");
    log("Старт детекта", "info");
    loop();
  } catch (e) {
    setStatus(`Ошибка: ${e.message}`, "error");
    log(`Ошибка: ${e.message}`, "danger");
    startBtn.disabled = false;
  }
});

resetBtn.addEventListener("click", () => {
  engine.reset();
  renderCards(0);
  logEl.innerHTML = "";
  if (faceLandmarker && video.srcObject) {
    running = true;
    lastVideoTime = -1;
    setStatus("🎥 Идёт детект. Не улыбайся!", "playing");
    log("Новый раунд", "info");
    loop();
  } else {
    setStatus("Сброшено. Включи камеру ▶", "ready");
  }
});
