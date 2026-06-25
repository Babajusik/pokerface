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

  // Локальный отсчёт 3-2-1
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
      {/* Шапка: бейдж ХОСТ + название/код + счётчик + выход */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isHost && (
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>ХОСТ</Text>
            </View>
          )}
          <View>
            <Text style={styles.title} numberOfLines={1}>{snapshot.lobbyName || "Лобби"}</Text>
            {snapshot.code ? <Text style={styles.code}>код: {snapshot.code}</Text> : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.counter}>
            {snapshot.players.length} <Text style={styles.counterDim}>из {snapshot.maxPlayers}</Text>
          </Text>
          <Pressable onPress={onLeave}><Text style={styles.leave}>Выйти</Text></Pressable>
        </View>
      </View>

      {/* Список игроков со статусом готовности (как в макете) */}
      <View style={styles.roster}>
        {snapshot.players.map((p, i) => (
          <View key={p.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Text style={styles.name} numberOfLines={1}>
              {p.id === snapshot.hostId ? "👑 " : ""}
              {p.name}
              {p.id === mySessionId ? " (ты)" : ""}
            </Text>
            <Text style={[styles.status, p.ready ? styles.ready : styles.notReady]}>
              {p.ready ? "готов ✓" : "не готов"}
            </Text>
          </View>
        ))}
      </View>

      {/* Камеры игроков */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <LiveKitVideo
          roomName={roomId}
          identity={mySessionId}
          name={me?.name || "Игрок"}
          players={snapshot.players}
          hostId={snapshot.hostId}
        />
      </ScrollView>

      {/* Низ: отсчёт или кнопки */}
      {counting ? (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownBig}>{count > 0 ? count : "GO!"}</Text>
        </View>
      ) : (
        <>
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
                <Text style={styles.startText}>НАЧАТЬ</Text>
              </Pressable>
            )}
          </View>
          {isHost && !allReady ? (
            <Text style={styles.hint}>Нужно ≥2 игроков, и все должны быть готовы</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  hostBadge: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  hostBadgeText: { color: "#06201d", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  code: { color: colors.accent, fontWeight: "700", letterSpacing: 1, fontSize: 12, marginTop: 2 },
  headerRight: { alignItems: "flex-end", gap: 6 },
  counter: { color: colors.text, fontSize: 18, fontWeight: "800" },
  counterDim: { color: colors.muted, fontWeight: "600", fontSize: 14 },
  leave: { color: colors.muted, fontSize: 14 },

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

  scroll: { paddingVertical: 10 },

  controls: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  btnIdle: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  btnReady: { backgroundColor: "rgba(52,211,153,0.18)", borderWidth: 1, borderColor: colors.green },
  btnStart: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  btnText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  startText: { color: "#06201d", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  hint: { color: colors.muted, textAlign: "center", marginTop: 10, fontSize: 13 },
  countdownBox: { padding: 16, alignItems: "center" },
  countdownBig: { color: colors.accent, fontSize: 64, fontWeight: "900", letterSpacing: -2 },
});
