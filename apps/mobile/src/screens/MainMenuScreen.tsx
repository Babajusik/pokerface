import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";

export function MainMenuScreen({
  name,
  onNameChange,
  onCreate,
  onFind,
  onSettings,
}: {
  name: string;
  onNameChange: (s: string) => void;
  onCreate: () => void;
  onFind: () => void;
  onSettings: () => void;
}) {
  const ready = name.trim().length > 0;
  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>🎭</Text>
      <Text style={styles.title}>PokerFace</Text>
      <Text style={styles.subtitle}>Не улыбайся. Останься последним.</Text>

      <TextInput
        style={styles.input}
        placeholder="Твоё имя"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={onNameChange}
        maxLength={16}
      />

      <Pressable
        style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed, !ready && styles.disabled]}
        disabled={!ready}
        onPress={onCreate}
      >
        <Text style={styles.primaryText}>➕ Создать игру</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.secondary, pressed && styles.pressed, !ready && styles.disabled]}
        disabled={!ready}
        onPress={onFind}
      >
        <Text style={styles.secondaryText}>🔍 Найти игру</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.btn, styles.ghost, pressed && styles.pressed]} onPress={onSettings}>
        <Text style={styles.ghostText}>⚙ Настройки</Text>
      </Pressable>

      {!ready && <Text style={styles.hint}>Введи имя, чтобы продолжить</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 0 },
  logo: { fontSize: 76 },
  title: { color: colors.text, fontSize: 46, fontWeight: "900", letterSpacing: -2, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 8, marginBottom: 28 },
  input: {
    width: "100%", maxWidth: 360, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 14, color: colors.text, fontSize: 16, marginBottom: 16,
  },
  btn: { width: "100%", maxWidth: 360, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 10 },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: "#10210a", fontSize: 16, fontWeight: "800" },
  secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  ghost: { padding: 12 },
  ghostText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  hint: { color: colors.muted, marginTop: 14, fontSize: 13 },
});
