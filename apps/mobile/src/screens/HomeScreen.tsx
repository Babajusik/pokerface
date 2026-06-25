import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../theme";

export function HomeScreen({
  onJoin,
  connecting,
  error,
}: {
  onJoin: (name: string) => void;
  connecting: boolean;
  error: string;
}) {
  const [name, setName] = useState("");

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
        onChangeText={setName}
        maxLength={16}
      />

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          (!name.trim() || connecting) && styles.disabled,
        ]}
        disabled={!name.trim() || connecting}
        onPress={() => onJoin(name.trim())}
      >
        {connecting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>🎮 Играть</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontSize: 76 },
  title: { color: colors.text, fontSize: 46, fontWeight: "900", letterSpacing: -2, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 8, marginBottom: 36, letterSpacing: 0.2 },
  input: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 14,
    transitionDuration: "150ms",
  } as any,
  buttonPressed: { backgroundColor: colors.accentDim, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  buttonText: { color: "#10210a", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  error: { color: colors.red, marginTop: 16, textAlign: "center" },
});
