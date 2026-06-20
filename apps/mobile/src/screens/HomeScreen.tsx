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
        style={[styles.button, (!name.trim() || connecting) && styles.disabled]}
        disabled={!name.trim() || connecting}
        onPress={() => onJoin(name.trim())}
      >
        {connecting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Войти в лобби</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontSize: 64 },
  title: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6, marginBottom: 32 },
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
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { color: colors.red, marginTop: 16, textAlign: "center" },
});
