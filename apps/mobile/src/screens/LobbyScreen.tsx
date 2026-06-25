import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../theme";
import { LiveKitVideo } from "../video/LiveKitVideo";
import { playSound } from "../sound";
import type { GameSnapshot } from "../net/useGame";

export function LobbyScreen({
  snapshot,
  mySessionId,
  roomId,
  onReady,
  onStart,
  onLeave,
}: {
  snapshot: GameSnapshot;
  mySessionId: string;
  roomId: string;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const me = snapshot.players.find((p) => p.id === mySessionId);
  const isHost = snapshot.hostId === mySessionId;
  const allReady = snapshot.players.length >= 2 && snapshot.players.every((p) => p.ready);
  const counting = snapshot.phase === "countdown";

  // Локальный отсчёт 3-2-1 (все входят в countdown одновременно)
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

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{snapshot.lobbyName || "Лобби"}</Text>
        <Pressable onPress={onLeave}>
          <Text style={styles.leave}>Выйти</Text>
        </Pressable>
      </View>
      <View style={styles.subRow}>
        <Text style={styles.count}>{snapshot.players.length} игрок(ов)</Text>
        {snapshot.code ? <Text style={styles.code}>Код: {snapshot.code}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <LiveKitVideo
          roomName={roomId}
          identity={mySessionId}
          name={me?.name || "Игрок"}
          players={snapshot.players}
          hostId={snapshot.hostId}
        />
      </ScrollView>

      {counting ? (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownBig}>{count > 0 ? count : "GO!"}</Text>
        </View>
      ) : (
        <View style={styles.controls}>
          <Pressable
            style={[styles.btn, me?.ready ? styles.btnReady : styles.btnIdle]}
            onPress={() => onReady(!me?.ready)}
          >
            <Text style={styles.btnText}>{me?.ready ? "✓ Готов" : "Я готов"}</Text>
          </Pressable>

          {isHost && (
            <Pressable
              style={[styles.btn, styles.btnStart, !allReady && styles.disabled]}
              disabled={!allReady}
              onPress={onStart}
            >
              <Text style={styles.btnText}>Начать игру</Text>
            </Pressable>
          )}
        </View>
      )}
      {isHost && !allReady && !counting ? (
        <Text style={styles.hint}>Нужно ≥2 игроков и чтобы все были готовы</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: 26, fontWeight: "800" },
  leave: { color: colors.muted, fontSize: 15 },
  subRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 10 },
  count: { color: colors.muted },
  code: { color: colors.accent, fontWeight: "800", letterSpacing: 1 },
  scroll: { paddingVertical: 8 },
  controls: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  btnIdle: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  btnReady: { backgroundColor: "rgba(52,211,153,0.18)", borderWidth: 1, borderColor: colors.green },
  btnStart: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  btnText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  hint: { color: colors.muted, textAlign: "center", marginTop: 10, fontSize: 13 },
  countdownBox: { padding: 16, alignItems: "center" },
  countdownBig: { color: colors.accent, fontSize: 64, fontWeight: "900", letterSpacing: -2 },
});
