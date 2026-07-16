import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from "react-native";
import { colors } from "../theme";
import { t, useLang } from "../i18n";
import { DOWNLOADS, detectPlatform, isStandalone, useCanInstall, promptInstall } from "../install";

// Страница «Скачать приложение»: установка в один клик там, где это возможно
// (Chrome/Edge на Android и Windows), прямые ссылки на .exe/.apk и инструкция
// для iOS — на айфоне установить программно нельзя, Apple не даёт API.
export function DownloadsScreen({ onBack }: { onBack: () => void }) {
  useLang();
  const platform = detectPlatform();
  const canInstall = useCanInstall();
  const installed = isStandalone();
  const [busy, setBusy] = useState(false);

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  async function onInstall() {
    setBusy(true);
    await promptInstall();
    setBusy(false);
  }

  // Карточка установки «в один клик» (Android/Windows Chrome/Edge)
  const InstallCard = () =>
    canInstall ? (
      <View style={[styles.card, styles.cardHot]}>
        <Text style={styles.cardTitle}>{t("dl.instantTitle")}</Text>
        <Text style={styles.cardText}>{t("dl.instantText")}</Text>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}
          disabled={busy}
          onPress={onInstall}
        >
          <Text style={styles.primaryText}>{t("dl.installBtn")}</Text>
        </Pressable>
      </View>
    ) : null;

  const IosCard = () => (
    <View style={[styles.card, platform === "ios" && styles.cardHot]}>
      <Text style={styles.cardTitle}>{t("dl.iosTitle")}</Text>
      <Text style={styles.cardText}>{t("dl.iosIntro")}</Text>
      <View style={styles.steps}>
        <Step n="1" text={t("dl.iosStep1")} />
        <Step n="2" text={t("dl.iosStep2")} />
        <Step n="3" text={t("dl.iosStep3")} />
      </View>
      <Text style={styles.note}>{t("dl.iosNote")}</Text>
    </View>
  );

  const WinCard = () => (
    <View style={[styles.card, platform === "windows" && styles.cardHot]}>
      <Text style={styles.cardTitle}>{t("dl.winTitle")}</Text>
      <Text style={styles.cardText}>{t("dl.winText")}</Text>
      <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => open(DOWNLOADS.windows)}>
        <Text style={styles.secondaryText}>{t("dl.winBtn")}</Text>
      </Pressable>
    </View>
  );

  const AndroidCard = () => (
    <View style={[styles.card, platform === "android" && styles.cardHot]}>
      <Text style={styles.cardTitle}>{t("dl.androidTitle")}</Text>
      <Text style={styles.cardText}>{t("dl.androidText")}</Text>
      <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => open(DOWNLOADS.android)}>
        <Text style={styles.secondaryText}>{t("dl.androidBtn")}</Text>
      </Pressable>
      <Text style={styles.note}>{t("dl.androidNote")}</Text>
    </View>
  );

  // Сначала — карточка под твою платформу, остальные ниже.
  const order =
    platform === "ios" ? [IosCard, WinCard, AndroidCard]
    : platform === "android" ? [AndroidCard, IosCard, WinCard]
    : platform === "windows" ? [WinCard, AndroidCard, IosCard]
    : [WinCard, AndroidCard, IosCard];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>{t("common.back")}</Text></Pressable>
        <Text style={styles.title}>{t("dl.title")}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {installed ? <Text style={styles.installed}>{t("dl.alreadyInstalled")}</Text> : null}
        <Text style={styles.lead}>{t("dl.lead")}</Text>
        <InstallCard />
        {order.map((C, i) => <C key={i} />)}
      </ScrollView>
    </View>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepN}>{n}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { paddingVertical: 6, width: 60 },
  backText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  body: { gap: 12, paddingBottom: 40, maxWidth: 520, width: "100%", alignSelf: "center" },
  lead: { color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: 2 },
  installed: {
    color: colors.green, fontSize: 13, fontWeight: "700", textAlign: "center",
    borderWidth: 1, borderColor: colors.green, borderRadius: 999, paddingVertical: 6, overflow: "hidden",
  },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 8 },
  cardHot: { borderColor: colors.accent }, // подсветка под текущую платформу
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  cardText: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  primary: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: "900" },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  secondaryText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  steps: { gap: 8, marginTop: 4 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepN: {
    color: colors.onAccent, backgroundColor: colors.accent, width: 22, height: 22, borderRadius: 999,
    textAlign: "center", lineHeight: 22, fontSize: 12, fontWeight: "900", overflow: "hidden",
  },
  stepText: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
  note: { color: colors.muted, fontSize: 12, fontStyle: "italic", marginTop: 2 },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
