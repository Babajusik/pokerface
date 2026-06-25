import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { getSettings, saveSettings } from "../settings";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = getSettings();
  const [name, setName] = useState(s.name);
  const [threshold, setThreshold] = useState(s.smileThreshold);
  const [frames, setFrames] = useState(s.smileFrames);
  const [sound, setSound] = useState(s.sound);

  function persist(patch: Partial<typeof s>) {
    saveSettings(patch);
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Назад</Text></Pressable>
        <Text style={styles.title}>Настройки</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Имя</Text>
        <TextInput
          style={styles.input}
          value={name}
          maxLength={16}
          placeholder="Твоё имя"
          placeholderTextColor={colors.muted}
          onChangeText={(t) => { setName(t); persist({ name: t }); }}
        />

        <Text style={styles.label}>Чувствительность улыбки: {round(threshold)}</Text>
        <Text style={styles.hint}>Ниже — ловит даже лёгкую улыбку, выше — только явную.</Text>
        <View style={styles.row}>
          <Pressable style={styles.step} onPress={() => { const v = Math.max(0.3, round(threshold - 0.05)); setThreshold(v); persist({ smileThreshold: v }); }}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.val}>{round(threshold)}</Text>
          <Pressable style={styles.step} onPress={() => { const v = Math.min(0.9, round(threshold + 0.05)); setThreshold(v); persist({ smileThreshold: v }); }}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Кадров подряд для срабатывания: {frames}</Text>
        <View style={styles.row}>
          <Pressable style={styles.step} onPress={() => { const v = Math.max(1, frames - 1); setFrames(v); persist({ smileFrames: v }); }}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.val}>{frames}</Text>
          <Pressable style={styles.step} onPress={() => { const v = Math.min(10, frames + 1); setFrames(v); persist({ smileFrames: v }); }}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <Pressable style={styles.toggleRow} onPress={() => { const v = !sound; setSound(v); persist({ sound: v }); }}>
          <Text style={styles.toggleLabel}>Звук</Text>
          <View style={[styles.switch, sound && styles.switchOn]}>
            <View style={[styles.knob, sound && styles.knobOn]} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { color: colors.accent, fontSize: 16, width: 60 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  body: { padding: 8, maxWidth: 420, width: "100%", alignSelf: "center" },
  label: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  step: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepText: { color: colors.text, fontSize: 26, fontWeight: "800" },
  val: { color: colors.accent, fontSize: 22, fontWeight: "800", minWidth: 56, textAlign: "center" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28 },
  toggleLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },
  switch: { width: 52, height: 30, borderRadius: 999, backgroundColor: colors.border, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 24, height: 24, borderRadius: 999, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
});
