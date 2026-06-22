import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Room, RoomEvent, Track, LocalVideoTrack } from "livekit-client";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { TOKEN_BASE } from "../net/config";
import { SmileDetector } from "../smile/SmileDetector";
import { colors } from "../theme";
import type { PlayerView } from "../net/useGame";

// Видео-сетка (web) + детект улыбки.
// Камера открывается ОДИН раз через getUserMedia: эта же дорожка идёт и в детект
// (MediaPipe), и публикуется в LiveKit. Поэтому детект работает независимо от
// того, подключилось ли видео LiveKit (важно в сетях, где видео режется).

type Status = "connecting" | "connected" | "disabled" | "error";

const MP_VERSION = "0.10.12";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export function LiveKitVideo({
  roomName,
  identity,
  name,
  players,
  hostId,
  detectActive = false,
  onSmile,
}: {
  roomName: string;
  identity: string;
  name: string;
  players: PlayerView[];
  hostId: string;
  detectActive?: boolean;
  onSmile?: () => void;
}) {
  const roomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [errMsg, setErrMsg] = useState("");
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  // --- Камера (один раз) + подключение к LiveKit ---
  useEffect(() => {
    let cancelled = false;
    async function start() {
      // 1. Камера — best-effort (если её нет, видео/детект просто не идут).
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        rerender();
      } catch {
        /* нет камеры — ок, есть DEV-кнопка */
      }

      // 2. Токен + подключение к LiveKit.
      try {
        const url = `${TOKEN_BASE}/livekit-token?room=${encodeURIComponent(
          roomName
        )}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(name)}`;
        const res = await fetch(url);
        if (res.status === 503) {
          setStatus("disabled");
          return;
        }
        if (!res.ok) throw new Error(`токен: HTTP ${res.status}`);
        const { token, url: wsUrl } = await res.json();
        if (cancelled) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        room
          .on(RoomEvent.TrackSubscribed, rerender)
          .on(RoomEvent.TrackUnsubscribed, rerender)
          .on(RoomEvent.ParticipantConnected, rerender)
          .on(RoomEvent.ParticipantDisconnected, rerender)
          .on(RoomEvent.Disconnected, rerender);

        await room.connect(wsUrl, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setStatus("connected");

        // 3. Публикуем нашу камеру (ту же, что в детекте).
        const vt = localStreamRef.current?.getVideoTracks()[0];
        if (vt) {
          try {
            await room.localParticipant.publishTrack(new LocalVideoTrack(vt), {
              source: Track.Source.Camera,
            });
          } catch {}
        }
        rerender();
      } catch (e: any) {
        setStatus("error");
        setErrMsg(e?.message || "ошибка LiveKit");
      }
    }
    start();
    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [roomName, identity, name]);

  // Поток для плитки игрока: локальный — своя камера, остальные — из LiveKit.
  function streamFor(pid: string): MediaStream | null {
    if (pid === identity) return localStreamRef.current;
    const rp = roomRef.current?.remoteParticipants.get(pid);
    if (!rp) return null;
    let track = rp.getTrackPublication(Track.Source.Camera)?.videoTrack?.mediaStreamTrack;
    if (!track) {
      // запасной поиск: первая доступная видео-дорожка участника
      for (const pub of rp.trackPublications.values()) {
        if (pub.videoTrack?.mediaStreamTrack) {
          track = pub.videoTrack.mediaStreamTrack;
          break;
        }
      }
    }
    return track ? new MediaStream([track]) : null;
  }

  // --- Детект улыбки по локальной камере (независимо от LiveKit) ---
  const detectVideoRef = useRef<HTMLVideoElement | null>(null);
  const smileRef = useRef(new SmileDetector());
  const [smileProb, setSmileProb] = useState(0);
  const onSmileRef = useRef(onSmile);
  useEffect(() => {
    onSmileRef.current = onSmile;
  }, [onSmile]);

  useEffect(() => {
    if (!detectActive) return;
    let stopped = false;
    let raf: number | null = null;
    let lm: FaceLandmarker | null = null;
    let lastT = -1;
    smileRef.current.reset();

    async function run() {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        if (stopped) return;
        lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        loop();
      } catch {
        /* модель недоступна */
      }
    }

    function loop() {
      if (stopped) return;
      const v = detectVideoRef.current;
      const stream = localStreamRef.current;
      if (v && stream && v.srcObject !== stream) v.srcObject = stream;
      if (v && lm && v.readyState >= 2 && v.currentTime !== lastT) {
        lastT = v.currentTime;
        const now = performance.now();
        const result = lm.detectForVideo(v, now);
        const shapes = result.faceBlendshapes;
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
        setSmileProb(p);
        if (smileRef.current.push(p, face, now)) onSmileRef.current?.();
      }
      raf = requestAnimationFrame(loop);
    }

    run();
    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      lm?.close?.();
    };
  }, [detectActive, identity]);

  // --- Авто-клип «момент провала» ---
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elimRef = useRef(false);
  const [clipUrl, setClipUrl] = useState("");

  useEffect(() => {
    if (!detectActive) return;
    let stopped = false;
    let started = false;
    const iv = setInterval(() => {
      if (started || stopped) return;
      const stream = localStreamRef.current;
      if (!stream) return;
      try {
        const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
        chunksRef.current = [];
        rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        rec.start(1000);
        recRef.current = rec;
        started = true;
      } catch {}
    }, 500);
    return () => {
      stopped = true;
      clearInterval(iv);
      try {
        recRef.current?.stop();
      } catch {}
      recRef.current = null;
    };
  }, [detectActive]);

  useEffect(() => {
    const me = players.find((p) => p.id === identity);
    if (me?.eliminated && !elimRef.current) {
      elimRef.current = true;
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = () =>
          setClipUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: "video/webm" })));
        try {
          rec.stop();
        } catch {}
      }
    }
    if (!me?.eliminated) elimRef.current = false;
  }, [players, identity]);

  function shareClip() {
    fetch(clipUrl)
      .then((r) => r.blob())
      .then((b) => {
        const file = new File([b], "pokerface-fail.webm", { type: "video/webm" });
        const nav = navigator as any;
        if (nav.canShare?.({ files: [file] })) nav.share({ files: [file], title: "PokerFace" });
      });
  }

  if (status === "disabled") {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          📹 Видео выключено. Добавь ключи LiveKit в server/game/.env и перезапусти сервер.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {clipUrl ? (
        <View style={styles.clip}>
          <Text style={styles.clipTitle}>🎬 Твой момент провала</Text>
          {React.createElement("video", {
            src: clipUrl,
            controls: true,
            autoPlay: true,
            loop: true,
            muted: true,
            style: { width: 240, borderRadius: 12, background: "#000" },
          })}
          <View style={styles.clipBtns}>
            <Pressable style={styles.clipBtn} onPress={shareClip}>
              <Text style={styles.clipBtnText}>📤 Поделиться</Text>
            </Pressable>
            {React.createElement(
              "a",
              {
                href: clipUrl,
                download: "pokerface-fail.webm",
                style: {
                  background: colors.accent,
                  color: "#06201d",
                  padding: "10px 16px",
                  borderRadius: 10,
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: 14,
                },
              },
              "⬇ Скачать"
            )}
          </View>
        </View>
      ) : null}

      {status === "error" && (
        <Text style={styles.note}>Видео недоступно ({errMsg}) — игра работает, детект тоже.</Text>
      )}

      <View style={styles.grid}>
        {players.map((p) => {
          const stream = streamFor(p.id);
          const isMe = p.id === identity;
          const border =
            p.cards >= 2 ? colors.red : p.cards === 1 ? colors.yellow : colors.border;
          return (
            <View
              key={p.id}
              style={[styles.tile, { borderColor: border, opacity: p.eliminated ? 0.45 : 1 }]}
            >
              <View style={styles.videoBox}>
                {stream
                  ? React.createElement("video", {
                      autoPlay: true,
                      playsInline: true,
                      muted: true,
                      ref: (el: HTMLVideoElement | null) => {
                        if (el && el.srcObject !== stream) el.srcObject = stream;
                        // детект гоним по своему ВИДИМОМУ видео (скрытое не декодируется)
                        if (isMe) detectVideoRef.current = el;
                      },
                      style: {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: isMe ? "scaleX(-1)" : "none",
                      },
                    })
                  : <Text style={styles.placeholder}>{p.eliminated ? "💀" : "🎥"}</Text>}
                {p.cards > 0 && (
                  <Text style={styles.cardBadge}>{p.cards >= 2 ? "🟥" : "🟨"}</Text>
                )}
                {isMe && detectActive && (
                  <Text style={styles.smile}>{Math.round(smileProb * 100)}%</Text>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {p.id === hostId ? "👑 " : ""}
                {isMe ? "Ты" : p.name}
                {p.ready && !p.eliminated ? " ✓" : ""}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  tile: {
    width: 160,
    margin: 6,
    borderWidth: 2,
    borderRadius: 14,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  videoBox: { height: 120, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  placeholder: { fontSize: 34 },
  cardBadge: { position: "absolute", top: 6, right: 8, fontSize: 18 },
  smile: {
    position: "absolute",
    bottom: 6,
    left: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  name: { color: colors.text, padding: 8, fontSize: 13, fontWeight: "600" },
  note: { color: colors.muted, textAlign: "center", marginVertical: 8 },
  banner: {
    padding: 12,
    margin: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  bannerText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  clip: { alignItems: "center", padding: 12, marginBottom: 8 },
  clipTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  clipBtns: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },
  clipBtn: { backgroundColor: colors.yellow, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  clipBtnText: { color: "#1a1a1a", fontWeight: "700", fontSize: 14 },
});
