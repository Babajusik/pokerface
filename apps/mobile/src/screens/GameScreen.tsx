import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../theme";
import { LiveKitVideo } from "../video/LiveKitVideo";
import { playSound } from "../sound";
import type { GameSnapshot } from "../net/useGame";

// Игровой экран: видео-сетка LiveKit (камеры всех) + детект улыбки по своей
// камере. DEV-кнопка «Улыбнуться» оставлена как запасной вариант.
export function GameScreen({
  snapshot,
  mySessionId,
  roomId,
  taunt,
  onSmile,
  onRematch,
  onLeave,
}: {
  snapshot: GameSnapshot;
  mySessionId: string;
  roomId: string;
  taunt: { text: string; ts: number };
  onSmile: () => void;
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
          <Text style={styles.devLabel}>запасная кнопка (если камера не сработала):</Text>
          <Pressable
            style={({ pressed }) => [styles.smileBtn, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={onSmile}
          >
            <Text style={styles.smileText}>😀 Улыбнуться</Text>
          </Pressable>
        </View>
      )}
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
  rematchBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  rematchText: { color: "#06201d", fontSize: 16, fontWeight: "800" },
});
