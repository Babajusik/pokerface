import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { getSettings, saveSettings } from "../settings";
import { t, useLang, setLang, type Lang } from "../i18n";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = getSettings();
  const lang = useLang();
  const [name, setName] = useState(s.name);
  const [sound, setSound] = useState(s.sound);
  const [voice, setVoice] = useState(s.voice);

  function persist(patch: Partial<typeof s>) {
    saveSettings(patch);
  }

  const langs: [Lang, string][] = [
    ["ru", "Русский"],
    ["en", "English"],
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>{t("common.back")}</Text></Pressable>
        <Text style={styles.title}>{t("settings.title")}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>{t("settings.name")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          maxLength={16}
          placeholder={t("menu.namePlaceholder")}
          placeholderTextColor={colors.muted}
          onChangeText={(v) => { setName(v); persist({ name: v }); }}
        />

        <Text style={styles.label}>{t("settings.language")}</Text>
        <View style={styles.row}>
          {langs.map(([code, lbl]) => (
            <Pressable
              key={code}
              style={[styles.seg, lang === code && styles.segOn]}
              onPress={() => setLang(code)}
            >
              <Text style={[styles.segText, lang === code && styles.segTextOn]}>{lbl}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.toggleRow} onPress={() => { const v = !sound; setSound(v); persist({ sound: v }); }}>
          <Text style={styles.toggleLabel}>{t("settings.sound")}</Text>
          <View style={[styles.switch, sound && styles.switchOn]}>
            <View style={[styles.knob, sound && styles.knobOn]} />
          </View>
        </Pressable>

        <Pressable style={styles.toggleRow} onPress={() => { const v = !voice; setVoice(v); persist({ voice: v }); }}>
          <Text style={styles.toggleLabel}>{t("settings.voice")}</Text>
          <View style={[styles.switch, voice && styles.switchOn]}>
            <View style={[styles.knob, voice && styles.knobOn]} />
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
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  seg: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: "center" },
  segOn: { borderColor: colors.accent, backgroundColor: "rgba(200,242,80,0.14)" },
  segText: { color: colors.muted, fontWeight: "700" },
  segTextOn: { color: colors.accent },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28 },
  toggleLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },
  switch: { width: 52, height: 30, borderRadius: 999, backgroundColor: colors.border, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 24, height: 24, borderRadius: 999, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
});
