import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../theme";
import { LiveKitVideo } from "../video/LiveKitVideo";
import { playSound, playGag } from "../sound";
import { speak } from "../speak";
import { ITEMS } from "@pokerface/shared";
import type { GameSnapshot } from "../net/useGame";

// Игровой экран: видео-сетка LiveKit (камеры всех) + детект улыбки по своей
// камере. DEV-кнопка «Улыбнуться» оставлена как запасной вариант.
export function GameScreen({
  snapshot,
  mySessionId,
  roomId,
  taunt,
  itemEffect,
  onSmile,
  onUseItem,
  onRematch,
  onLeave,
}: {
  snapshot: GameSnapshot;
  mySessionId: string;
  roomId: string;
  taunt: { text: string; ts: number };
  itemEffect: { itemId: string; text?: string; sticker?: string; fromName: string; ts: number };
  onSmile: () => void;
  onUseItem: (itemId: string, targetId: string) => void;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const me = snapshot.players.find((p) => p.id === mySessionId);
  const gameOver = snapshot.phase === "game_over";
  const winner = snapshot.players.find((p) => p.id === snapshot.winnerId);
  const iWon = snapshot.winnerId === mySessionId;
  const playing = snapshot.phase === "playing" && !me?.eliminated;

  // Баннер ИИ-ведущего (показываем ~6 сек на новую реплику)
  const [tauntVisible, setTauntVisible] = useState(false);
  useEffect(() => {
    if (!taunt.ts) return;
    setTauntVisible(true);
    speak(taunt.text);
    const t = setTimeout(() => setTauntVisible(false), 6000);
    return () => clearTimeout(t);
  }, [taunt.ts]);

  // Звуки на карточку и конец игры
  const prevCards = useRef(0);
  const prevPhase = useRef(snapshot.phase);
  useEffect(() => {
    const cards = me?.cards ?? 0;
    if (cards > prevCards.current) playSound(cards >= 2 ? "red" : "yellow");
    prevCards.current = cards;
    if (snapshot.phase !== prevPhase.current) {
      if (snapshot.phase === "game_over") playSound(iWon ? "win" : "lose");
      prevPhase.current = snapshot.phase;
    }
  }, [snapshot, me?.cards, iWon]);

  // ── Арсенал «провокатора» ──
  const [charges, setCharges] = useState<Record<string, number>>(() =>
    Object.fromEntries(ITEMS.map((i) => [i.id, i.charges]))
  );
  const [target, setTarget] = useState<string>("");
  useEffect(() => {
    if (snapshot.phase === "playing")
      setCharges(Object.fromEntries(ITEMS.map((i) => [i.id, i.charges])));
  }, [snapshot.phase]);
  const opponents = snapshot.players.filter((p) => p.id !== mySessionId && !p.eliminated);
  function fire(itemId: string) {
    if (!target || (charges[itemId] || 0) <= 0) return;
    onUseItem(itemId, target);
    setCharges((c) => ({ ...c, [itemId]: c[itemId] - 1 }));
  }

  // ── Эффект «прилетевшего» предмета (я — жертва) ──
  const [fx, setFx] = useState(false);
  useEffect(() => {
    if (!itemEffect.ts) return;
    if (itemEffect.itemId === "sound") playGag();
    setFx(true);
    const t = setTimeout(() => setFx(false), 3500);
    return () => clearTimeout(t);
  }, [itemEffect.ts]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{gameOver ? "Игра окончена" : "Не улыбайся!"}</Text>
        <Pressable onPress={onLeave}>
          <Text style={styles.leave}>Выйти</Text>
        </Pressable>
      </View>

      {tauntVisible && taunt.text ? (
        <View style={styles.taunt}>
          <Text style={styles.tauntIcon}>🤖</Text>
          <Text style={styles.tauntText}>{taunt.text}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <LiveKitVideo
          roomName={roomId}
          identity={mySessionId}
          name={me?.name || "Игрок"}
          players={snapshot.players}
          hostId={snapshot.hostId}
          detectActive={playing}
          onSmile={onSmile}
        />
      </ScrollView>

      {gameOver ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>{iWon ? "🏆" : "🎭"}</Text>
          <Text style={styles.resultText}>
            {iWon ? "Ты победил! Железное лицо." : `Победитель: ${winner?.name || "никто"}`}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.rematchBtn, pressed && { transform: [{ scale: 0.97 }] }]}
            onPress={onRematch}
          >
            <Text style={styles.rematchText}>↻ Реванш</Text>
          </Pressable>
        </View>
      ) : me?.eliminated ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultEmoji}>💀</Text>
          <Text style={styles.resultText}>Ты вылетел. Жди финала…</Text>
        </View>
      ) : (
        <View style={styles.devArea}>
          <Text style={styles.cardsLine}>Карточки: {me ? `${me.cards}/2` : "—"}</Text>

          {/* Арсенал «провокатора» */}
          <Text style={styles.arsenalLabel}>Цель:</Text>
          <View style={styles.targetRow}>
            {opponents.length === 0 ? (
              <Text style={styles.devLabel}>нет соперников</Text>
            ) : (
              opponents.map((o) => (
                <Pressable
                  key={o.id}
                  style={[styles.targetChip, target === o.id && styles.targetChipOn]}
                  onPress={() => setTarget(o.id)}
                >
                  <Text style={[styles.targetChipText, target === o.id && styles.targetChipTextOn]} numberOfLines={1}>
                    {o.name}
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
                  <Text style={styles.itemLabel}>{it.label}</Text>
                  <Text style={styles.itemCharges}>{left}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.smileBtnSm, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={onSmile}
          >
            <Text style={styles.smileTextSm}>😀 Улыбнуться (если нет камеры)</Text>
          </Pressable>
        </View>
      )}

      {/* Эффект прилетевшего предмета (я — жертва) */}
      {fx && itemEffect.itemId === "meme" ? (
        <View style={styles.fxOverlay} pointerEvents="none">
          <View style={styles.memeCard}>
            <Text style={styles.memeText}>{itemEffect.text}</Text>
            <Text style={styles.fxFrom}>от {itemEffect.fromName}</Text>
          </View>
        </View>
      ) : null}
      {fx && itemEffect.itemId === "sticker" ? (
        <View style={styles.fxOverlay} pointerEvents="none">
          <Text style={styles.stickerBig}>{itemEffect.sticker}</Text>
          <Text style={styles.fxFrom}>от {itemEffect.fromName}</Text>
        </View>
      ) : null}
      {fx && itemEffect.itemId === "sound" ? (
        <View style={styles.fxToast} pointerEvents="none">
          <Text style={styles.fxToastText}>🔊 {itemEffect.fromName} врубил гэг!</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  leave: { color: colors.muted, fontSize: 15 },
  scroll: { paddingVertical: 10 },
  taunt: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(45,212,191,0.12)", borderWidth: 1, borderColor: colors.accent,
    borderRadius: 14, padding: 12, marginTop: 10,
  },
  tauntIcon: { fontSize: 22 },
  tauntText: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1, fontStyle: "italic" },
  devArea: { alignItems: "center", paddingVertical: 12 },
  devLabel: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  smileBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  smileText: { color: "#1a1a1a", fontSize: 22, fontWeight: "800" },
  cardsLine: { color: colors.text, marginTop: 4, marginBottom: 8, fontSize: 15 },
  resultBox: { alignItems: "center", paddingVertical: 20 },
  resultEmoji: { fontSize: 56 },
  resultText: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 8 },

  arsenalLabel: { color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 6 },
  targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  targetChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  targetChipOn: { borderColor: colors.accent, backgroundColor: "rgba(45,212,191,0.16)" },
  targetChipText: { color: colors.muted, fontWeight: "600", maxWidth: 110 },
  targetChipTextOn: { color: colors.accent },
  itemsRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 12 },
  item: { alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minWidth: 64 },
  itemDim: { opacity: 0.4 },
  itemEmoji: { fontSize: 24 },
  itemLabel: { color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 2 },
  itemCharges: { color: colors.accent, fontSize: 12, fontWeight: "800", marginTop: 2 },
  smileBtnSm: { marginTop: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  smileTextSm: { color: colors.muted, fontSize: 13, fontWeight: "600" },

  fxOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,13,18,0.45)" },
  memeCard: { backgroundColor: colors.panel2, borderWidth: 2, borderColor: colors.accent, borderRadius: 20, padding: 28, maxWidth: 320, alignItems: "center" },
  memeText: { color: colors.text, fontSize: 26, fontWeight: "800", textAlign: "center" },
  stickerBig: { fontSize: 180 },
  fxFrom: { color: colors.muted, fontSize: 13, marginTop: 12 },
  fxToast: { position: "absolute", top: 80, left: 0, right: 0, alignItems: "center" },
  fxToastText: { backgroundColor: colors.panel2, color: colors.text, fontWeight: "700", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  rematchBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  rematchText: { color: "#10210a", fontSize: 16, fontWeight: "800" },
});
