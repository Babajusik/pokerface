import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { SmileDetector } from "./SmileDetector";
import { colors } from "../theme";

// Веб-детектор улыбки: веб-камера + MediaPipe Face Landmarker -> SmileDetector.
// Только для web (Metro подставит этот файл вместо .native). На native будет
// react-native-vision-camera + ML Kit (см. CameraSmile.native.tsx).

const VERSION = "0.10.12";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export function CameraSmile({
  active,
  onSmile,
}: {
  active: boolean;
  onSmile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const detectorRef = useRef(new SmileDetector());
  const activeRef = useRef(active);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "on" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [prob, setProb] = useState(0);
  const [faceVisible, setFaceVisible] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    let stopped = false;
    let lastT = -1;

    async function start() {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setStatus("on");
        loop();
      } catch (e: any) {
        setStatus("error");
        setErrMsg(e?.message || "нет доступа к камере");
      }
    }

    function loop() {
      if (stopped) return;
      const v = videoRef.current;
      const lm = landmarkerRef.current;
      if (v && lm && v.readyState >= 2 && v.currentTime !== lastT) {
        lastT = v.currentTime;
        const now = performance.now();
        const res = lm.detectForVideo(v, now);
        const shapes = res.faceBlendshapes;
        let p = 0;
        let face = false;
        if (shapes && shapes.length > 0) {
          face = true;
          let l = 0;
          let r = 0;
          for (const c of shapes[0].categories) {
            if (c.categoryName === "mouthSmileLeft") l = c.score;
            else if (c.categoryName === "mouthSmileRight") r = c.score;
          }
          p = (l + r) / 2;
        }
        setProb(p);
        setFaceVisible(face);
        if (activeRef.current && detectorRef.current.push(p, face, now)) {
          onSmile();
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    start();
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = videoRef.current;
      const s = v?.srcObject as MediaStream | undefined;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, [onSmile]);

  const over = prob >= detectorRef.current.config.smileThreshold;

  return (
    <View style={styles.wrap}>
      {/* На web react-native-web рендерит дерево в DOM, поэтому реальный <video> */}
      {React.createElement("video", {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: {
          width: 240,
          height: 180,
          objectFit: "cover",
          transform: "scaleX(-1)",
          borderRadius: 12,
          background: "#000",
        },
      })}
      <View style={styles.meterRow}>
        <View style={styles.meterBg}>
          <View
            style={[
              styles.meterFill,
              { width: `${Math.round(prob * 100)}%`, backgroundColor: over ? colors.red : colors.green },
            ]}
          />
        </View>
        <Text style={styles.meterText}>
          {status === "on" ? (faceVisible ? `${Math.round(prob * 100)}%` : "нет лица") : "…"}
        </Text>
      </View>
      {status === "loading" && <Text style={styles.note}>Загрузка модели…</Text>}
      {status === "error" && <Text style={styles.err}>Камера: {errMsg}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 8, width: 240 },
  meterBg: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#11151c",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  meterFill: { height: "100%" },
  meterText: { color: colors.muted, fontSize: 12, width: 56, textAlign: "right" },
  note: { color: colors.muted, fontSize: 12 },
  err: { color: colors.red, fontSize: 12, maxWidth: 240, textAlign: "center" },
});
