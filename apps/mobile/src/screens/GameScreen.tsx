import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../theme";
import { LiveKitVideo } from "../video/LiveKitVideo";
import type { GameSnapshot } from "../net/useGame";

// Игровой экран: видео-сетка LiveKit (камеры всех) + детект улыбки по своей
// камере. DEV-кнопка «Улыбнуться» оставлена как запасной вариант.
export function GameScreen({
  snapshot,
  mySessionId,
  roomId,
  onSmile,
  onLeave,
}: {
  snapshot: GameSnapshot;
  mySessionId: string;
  roomId: string;
  onSmile: () => void;
  onLeave: () => void;
}) {
  const me = snapshot.players.find((p) => p.id === mySessionId);
  const gameOver = snapshot.phase === "game_over";
  const winner = snapshot.players.find((p) => p.id === snapshot.winnerId);
  const iWon = snapshot.winnerId === mySessionId;
  const playing = snapshot.phase === "playing" && !me?.eliminated;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{gameOver ? "Игра окончена" : "Не улыбайся!"}</Text>
        <Pressable onPress={onLeave}>
          <Text style={styles.leave}>Выйти</Text>
        </Pressable>
      </View>

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
          <Pressable style={styles.smileBtn} onPress={onSmile}>
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
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  leave: { color: colors.muted, fontSize: 15 },
  scroll: { paddingVertical: 10 },
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
});
