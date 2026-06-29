import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { getStats } from "../stats";
import { TOKEN_BASE } from "../net/config";
import { t, useLang } from "../i18n";

export function MainMenuScreen({
  name,
  error,
  onNameChange,
  onQuickPlay,
  onCreate,
  onFind,
  onSettings,
}: {
  name: string;
  error?: string;
  onNameChange: (s: string) => void;
  onQuickPlay: () => void;
  onCreate: () => void;
  onFind: () => void;
  onSettings: () => void;
}) {
  useLang();
  const ready = name.trim().length > 0;
  const stats = getStats();
  const [online, setOnline] = useState<number | null>(null);
  const [invited, setInvited] = useState(false);

  // Онлайн (соц-доказательство)
  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const r = await fetch(`${TOKEN_BASE}/online`);
        const d = await r.json();
        if (!stop) setOnline(d.online ?? 0);
      } catch {}
    }
    load();
    const iv = setInterval(load, 5000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  function invite() {
    try {
      const url = typeof window !== "undefined" ? window.location.origin : "";
      const text = t("menu.inviteText", { url });
      const nav = navigator as any;
      if (nav.share) nav.share({ title: "PokerFace", text, url });
      else if (nav.clipboard) { nav.clipboard.writeText(text); setInvited(true); setTimeout(() => setInvited(false), 2000); }
    } catch {}
  }

  return (
    <View style={styles.wrap}>
      {/* retention: стрик + матчи + онлайн */}
      <View style={styles.stats}>
        {stats.streak > 0 && (
          <View style={styles.chip}><Text style={styles.chipHot}>🔥</Text><Text style={styles.chipText}> {stats.streak} </Text><Text style={styles.chipMuted}>{t("menu.days")}</Text></View>
        )}
        {stats.matches > 0 && (
          <View style={styles.chip}><Text style={styles.chipText}>🎭 {stats.matches}</Text><Text style={styles.chipMuted}> {t("menu.matches")}</Text></View>
        )}
        {online != null && (
          <View style={styles.online}><View style={styles.dot} /><Text style={styles.onlineText}>{online} {t("menu.online")}</Text></View>
        )}
      </View>

      <View style={styles.hero}>
        <Text style={styles.logo}>🎭</Text>
        <Text style={styles.title}>PokerFace</Text>
        <Text style={styles.subtitle}>{t("app.subtitle")}</Text>
      </View>

      <View style={styles.actions}>
        <TextInput
          style={styles.input}
          placeholder={t("menu.namePlaceholder")}
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={onNameChange}
          maxLength={16}
        />
        <Pressable
          style={({ pressed }) => [styles.quick, pressed && styles.pressed, !ready && styles.disabled]}
          disabled={!ready}
          onPress={onQuickPlay}
        >
          <Text style={styles.quickText}>{t("menu.quickPlay")}</Text>
        </Pressable>
        <View style={styles.pair}>
          <Pressable style={({ pressed }) => [styles.btn2, pressed && styles.pressed, !ready && styles.disabled]} disabled={!ready} onPress={onCreate}>
            <Text style={styles.btn2Text}>{t("menu.create")}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.btn2, pressed && styles.pressed, !ready && styles.disabled]} disabled={!ready} onPress={onFind}>
            <Text style={styles.btn2Text}>{t("menu.find")}</Text>
          </Pressable>
        </View>
        <Pressable style={({ pressed }) => [styles.invite, pressed && styles.pressed]} onPress={invite}>
          <Text style={styles.inviteText}>{invited ? t("menu.inviteCopied") : t("menu.invite")}</Text>
        </Pressable>
        <Pressable style={styles.ghost} onPress={onSettings}>
          <Text style={styles.ghostText}>{t("menu.settings")}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : !ready ? (
        <Text style={styles.hint}>{t("menu.enterName")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, paddingTop: 16 },
  stats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipHot: { color: colors.hot, fontSize: 13 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chipMuted: { color: colors.muted, fontSize: 13 },
  online: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.accent },
  onlineText: { color: colors.muted, fontSize: 13 },

  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 84 },
  title: { color: colors.text, fontSize: 50, fontWeight: "900", letterSpacing: -2, marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 8 },

  actions: { gap: 10 },
  input: { width: "100%", maxWidth: 400, alignSelf: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, color: colors.text, fontSize: 16 },
  quick: { width: "100%", maxWidth: 400, alignSelf: "center", minHeight: 58, backgroundColor: colors.accent, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  quickText: { color: colors.onAccent, fontSize: 19, fontWeight: "900" },
  pair: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 400, alignSelf: "center" },
  btn2: { flex: 1, minHeight: 50, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btn2Text: { color: colors.text, fontSize: 15, fontWeight: "700" },
  invite: { width: "100%", maxWidth: 400, alignSelf: "center", minHeight: 46, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  inviteText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  ghost: { alignItems: "center", padding: 8 },
  ghostText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  hint: { color: colors.muted, textAlign: "center", marginTop: 10, fontSize: 13 },
  err: { color: colors.red, textAlign: "center", marginTop: 10, fontSize: 13 },
});
