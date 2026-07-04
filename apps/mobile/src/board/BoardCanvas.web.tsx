import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { colors } from "../theme";
import { t, useLang } from "../i18n";
import { searchGifs, hasGiphy, uploadFile, type GifResult } from "./giphy";

// Общая доска (web): рисование + текст + медиа (фото/гиф/видео по ссылке) + очистка,
// синхронно у всех. Координаты нормализованы (0..1) — одинаково на любых экранах.
// Штрихи батчатся и рассылаются через sendBoardOp; входящие — через subscribeBoard.

const W = 960;
const H = 540; // 16:9 логический холст
const PALETTE = ["#c8f250", "#ff5b5b", "#ffd24a", "#ffffff", "#111111", "#4aa3ff"];
const VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;

// Распознаём YouTube/Vimeo, чтобы встроить их через iframe (обычные ссылки — это
// веб-страницы, а не файлы, и в <video> не играют).
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

type Pt = [number, number];
type Tool = "draw" | "text" | "media" | "gif";
interface MediaItem { id: string; url: string; x: number; y: number }
// Единый объект слоя (текст ИЛИ медиа) — порядок в массиве = z-порядок (новые сверху).
interface BoardItem { id: string; kind: "text" | "media"; x: number; y: number; text?: string; color?: string; url?: string }
interface BoardOp {
  kind: "stroke" | "text" | "clear" | "media";
  color?: string;
  w?: number;
  pts?: Pt[];
  x?: number;
  y?: number;
  text?: string;
  id?: string;
  url?: string;
}

// Определяет embed-ссылку и пропорции для видео-сервисов (iframe).
function iframeEmbed(url: string): { src: string; aspect: string } | null {
  const yt = youtubeId(url);
  if (yt) return { src: `https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&playsinline=1`, aspect: "16 / 9" };
  const vim = vimeoId(url);
  if (vim) return { src: `https://player.vimeo.com/video/${vim}?autoplay=1&muted=1&loop=1&background=1`, aspect: "16 / 9" };
  // VK Video: .../video{oid}_{id}
  const vk = url.match(/video(-?\d+)_(\d+)/);
  if (vk && /vk(?:video)?\.(?:com|ru)/i.test(url)) return { src: `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}&hd=2&autoplay=1`, aspect: "16 / 9" };
  // Rutube
  const rt = url.match(/rutube\.ru\/(?:video|play\/embed|shorts)\/([0-9a-f]+)/i);
  if (rt) return { src: `https://rutube.ru/play/embed/${rt[1]}`, aspect: "16 / 9" };
  // TikTok (вертикальное)
  const tt = url.match(/tiktok\.com\/(?:@[\w.-]+\/video\/|embed\/v2\/|player\/v1\/)(\d+)/);
  if (tt) return { src: `https://www.tiktok.com/player/v1/${tt[1]}?autoplay=1&muted=1&loop=1&description=0&music_info=0`, aspect: "9 / 16" };
  return null;
}

// Возвращает нужный DOM-элемент для медиа по URL (iframe / video / img).
function mediaEl(m: MediaItem) {
  const base: any = {
    position: "absolute",
    left: `${m.x * 100}%`,
    top: `${m.y * 100}%`,
    transform: "translate(-50%, -50%)",
    borderRadius: 8,
    border: "none",
    objectFit: "contain",
    pointerEvents: "none", // слой не перехватывает клики — ставить/рисовать можно везде
  };
  const emb = iframeEmbed(m.url);
  if (emb) {
    const vertical = emb.aspect === "9 / 16";
    return React.createElement("iframe", {
      key: m.id,
      src: emb.src,
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      allowFullScreen: true,
      style: { ...base, width: vertical ? "22%" : "36%", aspectRatio: emb.aspect },
    });
  }
  if (VIDEO_RE.test(m.url)) {
    return React.createElement("video", {
      key: m.id, src: m.url, autoPlay: true, loop: true, muted: true, playsInline: true, controls: true,
      style: { ...base, width: "36%" },
    });
  }
  return React.createElement("img", { key: m.id, src: m.url, style: { ...base, width: "34%" } });
}

export function BoardCanvas({
  sendBoardOp,
  subscribeBoard,
}: {
  sendBoardOp: (op: BoardOp) => void;
  subscribeBoard: (fn: (op: BoardOp) => void) => () => void;
}) {
  useLang();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [tool, setTool] = useState<Tool>("draw");
  const [value, setValue] = useState(""); // текст ИЛИ ссылка (по режиму)
  const [items, setItems] = useState<BoardItem[]>([]); // текст+медиа, порядок = z-порядок
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const selectedGifRef = useRef(selectedGif);
  useEffect(() => { selectedGifRef.current = selectedGif; }, [selectedGif]);
  const colorRef = useRef(color);
  const toolRef = useRef(tool);
  const valueRef = useRef(value);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { valueRef.current = value; }, [value]);

  // рисование
  const drawing = useRef(false);
  const lastLocal = useRef<Pt | null>(null);
  const pending = useRef<Pt[]>([]);
  const strokeStart = useRef<Pt | null>(null);
  const flushTimer = useRef<any>(null);

  function ctx() {
    if (!ctxRef.current && canvasRef.current) {
      canvasRef.current.width = W;
      canvasRef.current.height = H;
      ctxRef.current = canvasRef.current.getContext("2d");
      if (ctxRef.current) {
        ctxRef.current.lineCap = "round";
        ctxRef.current.lineJoin = "round";
      }
    }
    return ctxRef.current;
  }

  function drawStroke(c: CanvasRenderingContext2D, op: BoardOp) {
    const pts = op.pts || [];
    if (pts.length === 0) return;
    c.strokeStyle = op.color || "#fff";
    c.lineWidth = op.w || 4;
    c.beginPath();
    c.moveTo(pts[0][0] * W, pts[0][1] * H);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * W, pts[i][1] * H);
    c.stroke();
  }
  function applyOp(op: BoardOp) {
    if (op.kind === "media" || op.kind === "text") {
      if (!op.id) return;
      if (op.kind === "media" && !op.url) return;
      if (op.kind === "text" && !op.text) return;
      setItems((prev) =>
        prev.some((i) => i.id === op.id)
          ? prev
          : [...prev, { id: op.id!, kind: op.kind as "text" | "media", x: op.x || 0, y: op.y || 0, text: op.text, color: op.color, url: op.url }]
      );
      return;
    }
    const c = ctx();
    if (!c) return;
    if (op.kind === "clear") { c.clearRect(0, 0, W, H); setItems([]); }
    else if (op.kind === "stroke") drawStroke(c, op);
  }

  useEffect(() => {
    ctx();
    const unsub = subscribeBoard(applyOp);
    return unsub;
  }, [subscribeBoard]);

  function norm(e: any): Pt {
    const el = canvasRef.current!;
    const r = el.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  function flush() {
    flushTimer.current = null;
    if (pending.current.length === 0) return;
    const start = strokeStart.current;
    const batch = start ? [start, ...pending.current] : [...pending.current];
    sendBoardOp({ kind: "stroke", color: colorRef.current, w: 4, pts: batch });
    strokeStart.current = pending.current[pending.current.length - 1];
    pending.current = [];
  }

  function onDown(e: any) {
    const c = ctx();
    if (!c) return;
    const p = norm(e);
    // Текст: клик ставит текст.
    if (toolRef.current === "text" && valueRef.current.trim()) {
      const op: BoardOp = { kind: "text", id: Math.random().toString(36).slice(2), color: colorRef.current, x: p[0], y: p[1], text: valueRef.current.trim() };
      applyOp(op); sendBoardOp(op); setValue("");
      return;
    }
    // Медиа: клик ставит фото/гиф/видео по ссылке.
    if (toolRef.current === "media" && valueRef.current.trim()) {
      const url = valueRef.current.trim();
      const op: BoardOp = { kind: "media", id: Math.random().toString(36).slice(2), url, x: p[0], y: p[1] };
      applyOp(op); sendBoardOp(op); setValue("");
      return;
    }
    // GIF: выбрана гифка → клик ставит её в это место.
    if (toolRef.current === "gif" && selectedGifRef.current) {
      const op: BoardOp = { kind: "media", id: Math.random().toString(36).slice(2), url: selectedGifRef.current, x: p[0], y: p[1] };
      applyOp(op); sendBoardOp(op);
      return;
    }
    drawing.current = true;
    lastLocal.current = p;
    strokeStart.current = p;
    pending.current = [p];
    try { e.target.setPointerCapture?.(e.pointerId); } catch {}
  }
  function onMove(e: any) {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const p = norm(e);
    const last = lastLocal.current!;
    c.strokeStyle = colorRef.current;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(last[0] * W, last[1] * H);
    c.lineTo(p[0] * W, p[1] * H);
    c.stroke();
    lastLocal.current = p;
    pending.current.push(p);
    if (!flushTimer.current) flushTimer.current = setTimeout(flush, 60);
  }
  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    flush();
    strokeStart.current = null;
    lastLocal.current = null;
  }

  function clearBoard() {
    applyOp({ kind: "clear" });
    sendBoardOp({ kind: "clear" });
  }

  // Поиск гифок (GIPHY) с дебаунсом.
  useEffect(() => {
    if (tool !== "gif" || !gifQuery.trim()) { setGifResults([]); return; }
    let cancelled = false;
    setGifLoading(true);
    const id = setTimeout(async () => {
      const r = await searchGifs(gifQuery);
      if (!cancelled) { setGifResults(r); setGifLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [gifQuery, tool]);

  // Загрузка файла с устройства → кладём URL в поле, дальше клик по доске ставит.
  async function onFilePick(e: any) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadErr("");
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setValue(url);
    } catch {
      setUploadErr(t("board.uploadErr"));
    } finally {
      setUploading(false);
    }
  }

  const inputMode = tool === "text" || tool === "media";
  const cursor = tool === "text" ? "text" : (tool === "media" || (tool === "gif" && selectedGif)) ? "copy" : "crosshair";

  return (
    <View style={styles.wrap}>
      <View style={styles.tools}>
        {PALETTE.map((cc) => (
          <Pressable
            key={cc}
            style={[styles.swatch, { backgroundColor: cc }, color === cc && styles.swatchOn]}
            onPress={() => setColor(cc)}
          />
        ))}
        {/* Тонкая настройка цвета (hex/RGB) — нативный пикер браузера */}
        {React.createElement("input", {
          type: "color",
          value: color,
          onChange: (e: any) => setColor(e.target.value),
          title: t("board.customColor"),
          style: { width: 34, height: 30, padding: 0, border: `2px solid ${colors.border}`, borderRadius: 8, background: "transparent", cursor: "pointer" },
        })}
        <Pressable
          style={[styles.toolBtn, tool === "text" && styles.toolBtnOn]}
          onPress={() => { setTool(tool === "text" ? "draw" : "text"); setValue(""); }}
        >
          <Text style={[styles.toolText, tool === "text" && styles.toolTextOn]}>✏️ {t("board.text")}</Text>
        </Pressable>
        <Pressable
          style={[styles.toolBtn, tool === "media" && styles.toolBtnOn]}
          onPress={() => { setTool(tool === "media" ? "draw" : "media"); setValue(""); }}
        >
          <Text style={[styles.toolText, tool === "media" && styles.toolTextOn]}>🖼 {t("board.media")}</Text>
        </Pressable>
        <Pressable
          style={[styles.toolBtn, tool === "gif" && styles.toolBtnOn]}
          onPress={() => { setTool(tool === "gif" ? "draw" : "gif"); setSelectedGif(null); }}
        >
          <Text style={[styles.toolText, tool === "gif" && styles.toolTextOn]}>🎞 {t("board.gif")}</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={clearBoard}>
          <Text style={styles.toolText}>🗑 {t("board.clear")}</Text>
        </Pressable>
      </View>

      {inputMode ? (
        <View>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={setValue}
            placeholder={tool === "text" ? t("board.textPlaceholder") : t("board.mediaPlaceholder")}
            placeholderTextColor={colors.muted}
            maxLength={tool === "text" ? 80 : 400}
            autoFocus
          />
          <Text style={styles.textHint}>{tool === "text" ? t("board.textHint") : t("board.mediaHint")}</Text>
          {tool === "media" ? (
            <View style={styles.uploadRow}>
              <Pressable style={styles.toolBtn} onPress={() => fileInputRef.current?.click()} disabled={uploading}>
                <Text style={styles.toolText}>📁 {t("board.upload")}</Text>
              </Pressable>
              {uploading ? <ActivityIndicator color={colors.accent} /> : null}
              {uploadErr ? <Text style={styles.uploadErr}>{uploadErr}</Text> : null}
              {React.createElement("input", {
                type: "file",
                accept: "image/*,video/*",
                ref: (el: any) => { fileInputRef.current = el; },
                onChange: onFilePick,
                style: { display: "none" },
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {tool === "gif" ? (
        <View style={styles.gifPanel}>
          {!hasGiphy() ? (
            <Text style={styles.textHint}>{t("board.gifNoKey")}</Text>
          ) : (
            <>
              <TextInput
                style={styles.textInput}
                value={gifQuery}
                onChangeText={setGifQuery}
                placeholder={t("board.gifSearch")}
                placeholderTextColor={colors.muted}
                autoFocus
              />
              {gifLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 6 }} /> : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifRow}>
                {gifResults.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setSelectedGif(g.url)}
                    style={[styles.gifThumb, selectedGif === g.url && styles.gifThumbOn]}
                  >
                    {React.createElement("img", { src: g.thumb, style: { height: 96, borderRadius: 8, display: "block" } })}
                  </Pressable>
                ))}
              </ScrollView>
              {selectedGif ? <Text style={styles.textHint}>{t("board.gifPickHint")}</Text> : null}
            </>
          )}
        </View>
      ) : null}

      <View style={styles.canvasWrap}>
        {React.createElement("canvas", {
          ref: (el: HTMLCanvasElement | null) => { canvasRef.current = el; },
          onPointerDown: onDown,
          onPointerMove: onMove,
          onPointerUp: onUp,
          onPointerLeave: onUp,
          style: {
            width: "100%",
            aspectRatio: "16 / 9",
            display: "block",
            background: "#0b0d12",
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            touchAction: "none",
            cursor,
          },
        })}
        {/* Слой текст+медиа — поверх холста, не перехватывает клики (ставим/рисуем везде).
            Порядок в массиве = z-порядок: новый объект рисуется поверх старых. */}
        <View style={styles.mediaLayer} pointerEvents="none">
          {items.map((it) =>
            it.kind === "media"
              ? mediaEl({ id: it.id, url: it.url!, x: it.x, y: it.y })
              : React.createElement(
                  "div",
                  {
                    key: it.id,
                    style: {
                      position: "absolute",
                      left: `${it.x * 100}%`,
                      top: `${it.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      color: it.color || "#fff",
                      fontWeight: 800,
                      fontSize: 26,
                      fontFamily: "sans-serif",
                      whiteSpace: "nowrap",
                      textShadow: "0 1px 3px rgba(0,0,0,0.7)",
                      pointerEvents: "none",
                    },
                  },
                  it.text
                )
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 720, alignSelf: "center", gap: 8, paddingVertical: 8 },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "center" },
  swatch: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: "#fff" },
  toolBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  toolBtnOn: { borderColor: colors.accent },
  toolText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  toolTextOn: { color: colors.accent },
  textInput: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.accent, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15 },
  textHint: { color: colors.accent, fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 6 },
  canvasWrap: { position: "relative", width: "100%" },
  mediaLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  gifPanel: { gap: 6 },
  gifRow: { gap: 8, paddingVertical: 6, alignItems: "center" },
  gifThumb: { borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  gifThumbOn: { borderColor: colors.accent },
  uploadRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  uploadErr: { color: colors.red, fontSize: 12, fontWeight: "600" },
});
