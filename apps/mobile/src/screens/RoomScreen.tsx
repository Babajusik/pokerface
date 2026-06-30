import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../theme";
import { LiveKitVideo } from "../video/LiveKitVideo";
import { playSound, playGag } from "../sound";
import { speak, stopSpeak } from "../speak";
import { recordMatch } from "../stats";
import { ITEMS, ITEM_COOLDOWN_MS } from "@pokerface/shared";
import type { GameSnapshot } from "../net/useGame";
import { t, useLang } from "../i18n";

// Единый экран комнаты: лобби + игра в одном компоненте, чтобы LiveKitVideo
// был смонтирован ОДИН раз на всю сессию комнаты. Тогда при старте игры камера
// и подключение к LiveKit не пересоздаются — видео непрерывное (лобби → игра).
// Видео держится на фиксированной позиции в дереве; меняется только обвязка.
export function RoomScreen({
  snapshot,
  mySessionId,
  roomId,
  taunt,
  itemEffect,
  onReady,
  onStart,
  onSmile,
  onUseItem,
  onRematch,
  onLeave,
  onMediaReady,
  onFace,
}: {
  snapshot: GameSnapshot;
  mySessionId: string;
  roomId: string;
  taunt: { text: string; ts: number };
  itemEffect: { itemId: string; text?: string; sticker?: string; fromName: string; ts: number };
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onSmile: () => void;
  onUseItem: (itemId: string, targetId: string) => void;
  onRematch: () => void;
  onLeave: () => void;
  onMediaReady: (ready: boolean) => void;
  onFace: (visible: boolean) => void;
}) {
  useLang();
  const me = snapshot.players.find((p) => p.id === mySessionId);
  const isHost = snapshot.hostId === mySessionId;
  const phase = snapshot.phase;
  const inLobbyMode = phase === "lobby" || phase === "countdown";
  const counting = phase === "countdown";
  const gameOver = phase === "game_over";
  const winner = snapshot.players.find((p) => p.id === snapshot.winnerId);
  const iWon = snapshot.winnerId === mySessionId;
  const playing = phase === "playing" && !me?.eliminated;

  const allReady = snapshot.players.length >= 2 && snapshot.players.every((p) => p.ready);
  const allMedia = snapshot.players.every((p) => p.mediaReady);
  const canStart = allReady && allMedia;

  // ── Отсчёт 3-2-1 (лобби) ──
  const [count, setCount] = useState(3);
  useEffect(() => {
    if (!counting) return;
    setCount(3);
    playSound("tick");
    let n = 3;
    const iv = setInterval(() => {
      n -= 1;
      setCount(n);
      if (n > 0) playSound("tick");
      else { playSound("go"); clearInterval(iv); }
    }, 1000);
    return () => clearInterval(iv);
  }, [counting]);

  // ── Голос ведущего (сейчас отключён в speak), стоп при выходе ──
  useEffect(() => () => stopSpeak(), []);
  useEffect(() => {
    if (!taunt.ts) return;
    speak(taunt.text);
  }, [taunt.ts]);

  // ── Звуки на карточку и конец игры ──
  const prevCards = useRef(0);
  const prevPhase = useRef(phase);
  useEffect(() => {
    const cards = me?.cards ?? 0;
    if (cards > prevCards.current) playSound(cards >= 2 ? "red" : "yellow");
    prevCards.current = cards;
    if (phase !== prevPhase.current) {
      if (phase === "game_over") {
        playSound(iWon ? "win" : "lose");
        recordMatch();
      }
      prevPhase.current = phase;
    }
  }, [snapshot, me?.cards, iWon, phase]);

  // ── Арсенал «провокатора» ──
  const [charges, setCharges] = useState<Record<string, number>>(() =>
    Object.fromEntries(ITEMS.map((i) => [i.id, i.charges]))
  );
  const [target, setTarget] = useState<string>("");
  const lastFireRef = useRef(0);
  useEffect(() => {
    if (phase === "playing") {
      setCharges(Object.fromEntries(ITEMS.map((i) => [i.id, i.charges])));
      setTarget("");
      lastFireRef.current = 0;
    }
  }, [phase]);
  const opponents = snapshot.players.filter((p) => p.id !== mySessionId && !p.eliminated);
  useEffect(() => {
    if (target && !opponents.some((o) => o.id === target)) setTarget("");
  }, [target, opponents]);

  function fire(itemId: string) {
    if (!opponents.some((o) => o.id === target)) return;
    if ((charges[itemId] || 0) <= 0) return;
    const now = Date.now();
    if (now - lastFireRef.current < ITEM_COOLDOWN_MS) return;
    lastFireRef.current = now;
    onUseItem(itemId, target);
    setCharges((c) => ({ ...c, [itemId]: c[itemId] - 1 }));
  }

  // ── Эффект «прилетевшего» предмета ──
  const [fx, setFx] = useState(false);
  useEffect(() => {
    if (!itemEffect.ts) return;
    if (itemEffect.itemId === "sound") playGag();
    setFx(true);
    const tt = setTimeout(() => setFx(false), 3500);
    return () => clearTimeout(tt);
  }, [itemEffect.ts]);

  return (
    <View style={styles.wrap}>
      {/* ── ВЕРХ (index 0): шапка + ростер лобби. Меняется по фазе. ── */}
      <View>
        {inLobbyMode ? (
          <>
            <View style={styles.lobbyHeader}>
              <View style={styles.headerLeft}>
                {isHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>{t("lobby.host")}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.lobbyTitle} numberOfLines={1}>{snapshot.lobbyName || t("lobby.defaultName")}</Text>
                  {snapshot.code ? <Text style={styles.code}>{t("lobby.code", { code: snapshot.code })}</Text> : null}
                </View>
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.counter}>
                  {snapshot.players.length} <Text style={styles.counterDim}>{t("lobby.of")} {snapshot.maxPlayers}</Text>
                </Text>
                <Pressable onPress={onLeave}><Text style={styles.leave}>{t("common.leave")}</Text></Pressable>
              </View>
            </View>
            <View style={styles.roster}>
              {snapshot.players.map((p, i) => (
                <View key={p.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.id === snapshot.hostId ? "👑 " : ""}
                    {p.name}
                    {p.id === mySessionId ? t("lobby.youSuffix") : ""}
                    {!p.mediaReady ? " 📷…" : ""}
                  </Text>
                  <Text style={[styles.status, p.ready ? styles.ready : styles.notReady]}>
                    {p.ready ? t("lobby.ready") : t("lobby.notReady")}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.gameHeader}>
            <Text style={styles.gameTitle}>{gameOver ? t("game.over") : t("game.title")}</Text>
            <Pressable onPress={onLeave}><Text style={styles.leave}>{t("common.leave")}</Text></Pressable>
          </View>
        )}
      </View>

      {/* ── ВИДЕО (index 1): один экземпляр на всю комнату. Не пересоздаётся. ── */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <LiveKitVideo
          roomName={roomId}
          identity={mySessionId}
          name={me?.name || t("game.playerDefault")}
          players={snapshot.players}
          hostId={snapshot.hostId}
          detectActive={playing}
          onSmile={onSmile}
          onMediaReady={onMediaReady}
          onFace={onFace}
        />
      </ScrollView>

      {/* ── НИЗ (index 2): контролы по фазе. ── */}
      <View>
        {inLobbyMode ? (
          counting ? (
            <View style={styles.countdownBox}>
              <Text style={styles.countdownBig}>{count > 0 ? count : t("lobby.go")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.controls}>
                <Pressable
                  style={[styles.btn, me?.ready ? styles.btnReady : styles.btnIdle]}
                  onPress={() => onReady(!me?.ready)}
                >
                  <Text style={styles.btnText}>{me?.ready ? t("lobby.imReadyOn") : t("lobby.imReady")}</Text>
                </Pressable>
                {isHost && (
                  <Pressable
                    style={[styles.btn, styles.btnStart, !canStart && styles.disabled]}
                    disabled={!canStart}
                    onPress={onStart}
                  >
                    <Text style={styles.startText}>{t("lobby.start")}</Text>
                  </Pressable>
                )}
              </View>
              {isHost && !allReady ? (
                <Text style={styles.hint}>{t("lobby.needPlayers")}</Text>
              ) : isHost && !allMedia ? (
                <Text style={styles.hint}>{t("lobby.waitMedia")}</Text>
              ) : null}
            </>
          )
        ) : gameOver ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultEmoji}>{iWon ? "🏆" : "🎭"}</Text>
            <Text style={styles.resultText}>
              {iWon ? t("game.youWon") : t("game.winner", { name: winner?.name || t("game.nobody") })}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.rematchBtn, pressed && { transform: [{ scale: 0.97 }] }]}
              onPress={onRematch}
            >
              <Text style={styles.rematchText}>{t("game.rematch")}</Text>
            </Pressable>
          </View>
        ) : me?.eliminated ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultEmoji}>💀</Text>
            <Text style={styles.resultText}>{t("game.eliminated")}</Text>
          </View>
        ) : (
          <View style={styles.devArea}>
            <Text style={styles.cardsLine}>{me ? t("game.cards", { n: me.cards }) : "—"}</Text>
            <Text style={styles.arsenalLabel}>{t("game.target")}</Text>
            <View style={styles.targetRow}>
              {opponents.length === 0 ? (
                <Text style={styles.devLabel}>{t("game.noOpponents")}</Text>
              ) : (
                opponents.map((o) => (
                  <Pressable
                    key={o.id}
                    style={[styles.targetChip, target === o.id && styles.targetChipOn]}
                    onPress={() => setTarget(o.id)}
                  >
                    <Text style={[styles.targetChipText, target === o.id && styles.targetChipTextOn]} numberOfLines={1}>
                      {o.name}{!o.connected ? " ⏳" : ""}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
            <View style={styles.itemsRow}>
              {ITEMS.map((it) => {
                const left = charges[it.id] ?? 0;
                const disabled = !target || left <= 0;
                return (
                  <Pressable
                    key={it.id}
                    style={[styles.item, disabled && styles.itemDim]}
                    disabled={disabled}
                    onPress={() => fire(it.id)}
                  >
                    <Text style={styles.itemEmoji}>{it.emoji}</Text>
                    <Text style={styles.itemLabel}>{t(`item.${it.id}`)}</Text>
                    <Text style={styles.itemCharges}>{left}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* ── Эффекты прилетевших предметов (поверх, только в игре) ── */}
      {fx && itemEffect.itemId === "meme" ? (
        <View style={styles.fxOverlay} pointerEvents="none">
          <View style={styles.memeCard}>
            <Text style={styles.memeText}>{itemEffect.text}</Text>
            <Text style={styles.fxFrom}>{t("game.from", { name: itemEffect.fromName })}</Text>
          </View>
        </View>
      ) : null}
      {fx && itemEffect.itemId === "sticker" ? (
        <View style={styles.fxOverlay} pointerEvents="none">
          <Text style={styles.stickerBig}>{itemEffect.sticker}</Text>
          <Text style={styles.fxFrom}>{t("game.from", { name: itemEffect.fromName })}</Text>
        </View>
      ) : null}
      {fx && itemEffect.itemId === "sound" ? (
        <View style={styles.fxToast} pointerEvents="none">
          <Text style={styles.fxToastText}>{t("game.gag", { name: itemEffect.fromName })}</Text>
        </View>
      ) : null}

      {/* Анти-чит: предупреждение, если я прячу лицо */}
      {playing && me?.hidingWarn ? (
        <View style={styles.faceWarn} pointerEvents="none">
          <Text style={styles.faceWarnText}>{t("game.showFace")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  // лобби-шапка
  lobbyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  hostBadge: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  hostBadgeText: { color: "#10210a", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  lobbyTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  code: { color: colors.accent, fontWeight: "700", letterSpacing: 1, fontSize: 12, marginTop: 2 },
  headerRight: { alignItems: "flex-end", gap: 6 },
  counter: { color: colors.text, fontSize: 18, fontWeight: "800" },
  counterDim: { color: colors.muted, fontWeight: "600", fontSize: 14 },
  leave: { color: colors.muted, fontSize: 15 },
  // игровая шапка
  gameHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameTitle: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  // ростер
  roster: {
    marginTop: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 14,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: 17, fontWeight: "700", flex: 1 },
  status: { fontSize: 15, fontWeight: "700" },
  ready: { color: colors.green },
  notReady: { color: colors.muted },
  // видео
  scroll: { paddingVertical: 10 },
  // лобби-контролы
  controls: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  btnIdle: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  btnReady: { backgroundColor: "rgba(52,211,153,0.18)", borderWidth: 1, borderColor: colors.green },
  btnStart: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  btnText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  startText: { color: "#10210a", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  hint: { color: colors.muted, textAlign: "center", marginTop: 10, fontSize: 13 },
  countdownBox: { padding: 16, alignItems: "center" },
  countdownBig: { color: colors.accent, fontSize: 64, fontWeight: "900", letterSpacing: -2 },
  // игровые контролы
  devArea: { alignItems: "center", paddingVertical: 12 },
  devLabel: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  cardsLine: { color: colors.text, marginTop: 4, marginBottom: 8, fontSize: 15 },
  resultBox: { alignItems: "center", paddingVertical: 20 },
  resultEmoji: { fontSize: 56 },
  resultText: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 8 },
  arsenalLabel: { color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 6 },
  targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  targetChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  targetChipOn: { borderColor: colors.accent, backgroundColor: "rgba(200,242,80,0.16)" },
  targetChipText: { color: colors.muted, fontWeight: "600", maxWidth: 110 },
  targetChipTextOn: { color: colors.accent },
  itemsRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 12 },
  item: { alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minWidth: 64 },
  itemDim: { opacity: 0.4 },
  itemEmoji: { fontSize: 24 },
  itemLabel: { color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 2 },
  itemCharges: { color: colors.accent, fontSize: 12, fontWeight: "800", marginTop: 2 },
  // эффекты предметов
  fxOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,13,18,0.45)" },
  memeCard: { backgroundColor: colors.panel2, borderWidth: 2, borderColor: colors.accent, borderRadius: 20, padding: 28, maxWidth: 320, alignItems: "center" },
  memeText: { color: colors.text, fontSize: 26, fontWeight: "800", textAlign: "center" },
  stickerBig: { fontSize: 180 },
  fxFrom: { color: colors.muted, fontSize: 13, marginTop: 12 },
  fxToast: { position: "absolute", top: 80, left: 0, right: 0, alignItems: "center" },
  fxToastText: { backgroundColor: colors.panel2, color: colors.text, fontWeight: "700", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  faceWarn: { position: "absolute", top: 70, left: 16, right: 16, alignItems: "center" },
  faceWarnText: { backgroundColor: colors.red, color: "#fff", fontWeight: "800", fontSize: 15, textAlign: "center", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, overflow: "hidden" },
  rematchBtn: { marginTop: 16, backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  rematchText: { color: "#10210a", fontSize: 16, fontWeight: "800" },
});
