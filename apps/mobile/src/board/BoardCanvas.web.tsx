import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { t, useLang } from "../i18n";

// Общая доска (web): рисование + текст + очистка, синхронно у всех.
// Координаты нормализованы (0..1), чтобы одинаково рисовать на разных экранах.
// Штрихи батчатся и рассылаются через onBoardOp; входящие — через subscribeBoard.

const W = 960;
const H = 540; // 16:9 логический холст
const PALETTE = ["#c8f250", "#ff5b5b", "#ffd24a", "#ffffff", "#111111", "#4aa3ff"];

type Pt = [number, number];
interface BoardOp {
  kind: "stroke" | "text" | "clear";
  color?: string;
  w?: number;
  pts?: Pt[];
  x?: number;
  y?: number;
  text?: string;
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
  const [tool, setTool] = useState<"draw" | "text">("draw");
  const [text, setText] = useState("");
  const colorRef = useRef(color);
  const toolRef = useRef(tool);
  const textRef = useRef(text);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { textRef.current = text; }, [text]);

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
  function drawText(c: CanvasRenderingContext2D, op: BoardOp) {
    c.fillStyle = op.color || "#fff";
    c.font = "bold 34px sans-serif";
    c.fillText((op.text || "").slice(0, 80), (op.x || 0) * W, (op.y || 0) * H);
  }
  function applyOp(op: BoardOp) {
    const c = ctx();
    if (!c) return;
    if (op.kind === "clear") c.clearRect(0, 0, W, H);
    else if (op.kind === "stroke") drawStroke(c, op);
    else if (op.kind === "text") drawText(c, op);
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
    // Режим текста: клик ставит текст.
    if (toolRef.current === "text" && textRef.current.trim()) {
      const op: BoardOp = { kind: "text", color: colorRef.current, x: p[0], y: p[1], text: textRef.current.trim() };
      applyOp(op);
      sendBoardOp(op);
      setText(""); // очищаем для следующего, режим текста остаётся активным
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
          onPress={() => setTool(tool === "text" ? "draw" : "text")}
        >
          <Text style={[styles.toolText, tool === "text" && styles.toolTextOn]}>✏️ {t("board.text")}</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={clearBoard}>
          <Text style={styles.toolText}>🗑 {t("board.clear")}</Text>
        </Pressable>
      </View>

      {tool === "text" ? (
        <View>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={t("board.textPlaceholder")}
            placeholderTextColor={colors.muted}
            maxLength={80}
            autoFocus
          />
          <Text style={styles.textHint}>{t("board.textHint")}</Text>
        </View>
      ) : null}

      {React.createElement("canvas", {
        ref: (el: HTMLCanvasElement | null) => { canvasRef.current = el; },
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: onUp,
        onPointerLeave: onUp,
        style: {
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#0b0d12",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          touchAction: "none",
          cursor: tool === "text" ? "text" : "crosshair",
        },
      })}
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
});
