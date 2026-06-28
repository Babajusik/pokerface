import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { colors } from "../theme";
import { TOKEN_BASE } from "../net/config";

interface RoomInfo { roomId: string; lobbyName: string; phase: string; clients: number; maxClients: number; }

export function LobbyListScreen({
  onBack,
  onJoinById,
  onJoinByCode,
  connecting,
  error,
}: {
  onBack: () => void;
  onJoinById: (roomId: string) => void;
  onJoinByCode: (code: string) => void;
  connecting: boolean;
  error: string;
}) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`${TOKEN_BASE}/rooms`);
        const data = await res.json();
        if (!stop) { setRooms(Array.isArray(data) ? data : []); setLoadError(false); }
      } catch {
        if (!stop) setLoadError(true); // сервер недоступен — не маскируем под «пусто»
      }
      if (!stop) setLoading(false);
    }
    load();
    const iv = setInterval(load, 3000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  const open = rooms.filter((r) => r.phase === "lobby");

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Назад</Text></Pressable>
        <Text style={styles.title}>Найти игру</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.codeRow}>
        <TextInput
          style={styles.codeInput}
          placeholder="Код лобби"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          maxLength={6}
        />
        <Pressable
          style={[styles.codeBtn, (!code.trim() || connecting) && styles.dim]}
          disabled={!code.trim() || connecting}
          onPress={() => onJoinByCode(code.trim())}
        >
          <Text style={styles.codeBtnText}>Войти</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Открытые лобби</Text>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : loadError && open.length === 0 ? (
          <Text style={styles.empty}>Не удалось загрузить лобби. Проверь соединение — список обновится сам.</Text>
        ) : open.length === 0 ? (
          <Text style={styles.empty}>Пока нет открытых лобби. Создай своё!</Text>
        ) : (
          open.map((r) => {
            const full = r.clients >= r.maxClients;
            return (
              <Pressable
                key={r.roomId}
                style={({ pressed }) => [styles.roomRow, full && styles.roomFull, pressed && !full && { transform: [{ scale: 0.99 }] }]}
                disabled={connecting || full}
                onPress={() => onJoinById(r.roomId)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomName} numberOfLines={1}>{r.lobbyName}</Text>
                  <Text style={styles.roomMeta}>{r.clients}/{r.maxClients} игроков</Text>
                </View>
                <Text style={[styles.join, full && styles.joinFull]}>{full ? "полное" : "Войти ›"}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  back: { color: colors.accent, fontSize: 16, width: 60 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  codeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  codeInput: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, letterSpacing: 2 },
  codeBtn: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, justifyContent: "center" },
  codeBtnText: { color: colors.accent, fontWeight: "700" },
  dim: { opacity: 0.45 },
  section: { color: colors.muted, fontSize: 13, marginBottom: 10 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 24 },
  roomRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  roomName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  roomMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  roomFull: { opacity: 0.5 },
  join: { color: colors.accent, fontWeight: "700" },
  joinFull: { color: colors.muted },
  err: { color: colors.red, marginTop: 12, textAlign: "center" },
});
