import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../theme";
import type { HostLevel } from "@pokerface/shared";
import type { CreateOpts } from "../net/useGame";

export function CreateGameScreen({
  defaultName,
  onBack,
  onCreate,
  connecting,
  error,
}: {
  defaultName: string;
  onBack: () => void;
  onCreate: (opts: CreateOpts) => void;
  connecting: boolean;
  error: string;
}) {
  const [lobbyName, setLobbyName] = useState(`Игра ${defaultName}`.slice(0, 24));
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [hostLevel, setHostLevel] = useState<HostLevel>("normal");

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Назад</Text></Pressable>
        <Text style={styles.title}>Создать игру</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Название лобби</Text>
        <TextInput style={styles.input} value={lobbyName} onChangeText={setLobbyName} maxLength={24} />

        <Text style={styles.label}>Доступ</Text>
        <View style={styles.row}>
          <Pressable style={[styles.seg, !isPrivate && styles.segOn]} onPress={() => setIsPrivate(false)}>
            <Text style={[styles.segText, !isPrivate && styles.segTextOn]}>Открытое</Text>
          </Pressable>
          <Pressable style={[styles.seg, isPrivate && styles.segOn]} onPress={() => setIsPrivate(true)}>
            <Text style={[styles.segText, isPrivate && styles.segTextOn]}>По коду</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Макс. игроков: {maxPlayers}</Text>
        <View style={styles.row}>
          <Pressable style={styles.step} onPress={() => setMaxPlayers((n) => Math.max(2, n - 1))}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.maxNum}>{maxPlayers}</Text>
          <Pressable style={styles.step} onPress={() => setMaxPlayers((n) => Math.min(16, n + 1))}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>ИИ-ведущий (юмор)</Text>
        <View style={styles.row}>
          {([["off", "Выкл"], ["normal", "Обычный"], ["savage", "Жёсткий 18+"]] as [HostLevel, string][]).map(
            ([lvl, lbl]) => (
              <Pressable
                key={lvl}
                style={[styles.seg, hostLevel === lvl && styles.segOn]}
                onPress={() => setHostLevel(lvl)}
              >
                <Text style={[styles.segText, hostLevel === lvl && styles.segTextOn]}>{lbl}</Text>
              </Pressable>
            )
          )}
        </View>
        {hostLevel === "savage" && (
          <Text style={styles.warn}>⚠ Чёрный юмор и 18+. Только для компании взрослых.</Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.create, pressed && { transform: [{ scale: 0.98 }] }, connecting && styles.dim]}
          disabled={connecting}
          onPress={() => onCreate({ lobbyName: lobbyName.trim() || "Лобби", isPrivate, maxPlayers, hostLevel })}
        >
          {connecting ? <ActivityIndicator color="#06201d" /> : <Text style={styles.createText}>Создать и войти</Text>}
        </Pressable>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { color: colors.accent, fontSize: 16, width: 60 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  body: { padding: 8, gap: 8, maxWidth: 420, width: "100%", alignSelf: "center" },
  label: { color: colors.muted, fontSize: 13, marginTop: 14, marginBottom: 4 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  seg: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: "center" },
  segOn: { borderColor: colors.accent, backgroundColor: "rgba(45,212,191,0.14)" },
  segText: { color: colors.muted, fontWeight: "700" },
  segTextOn: { color: colors.accent },
  step: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepText: { color: colors.text, fontSize: 26, fontWeight: "800" },
  maxNum: { color: colors.text, fontSize: 22, fontWeight: "800", minWidth: 40, textAlign: "center" },
  warn: { color: colors.yellow, fontSize: 12, marginTop: 8 },
  create: { backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 24 },
  createText: { color: "#06201d", fontSize: 16, fontWeight: "800" },
  dim: { opacity: 0.6 },
  err: { color: colors.red, marginTop: 12, textAlign: "center" },
});
