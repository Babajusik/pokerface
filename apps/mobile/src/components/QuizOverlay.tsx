import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../theme";
import { t, useLang } from "../i18n";
import type { QuizQuestionPayload, QuizResultPayload } from "@pokerface/shared";
import type { PlayerView } from "../net/useGame";

// Оверлей режима «викторина»: вопрос с голосованием, затем вскрытие голосов.
// Смысл — рассмешить: улыбнулся на вскрытии → карточка (детект работает как обычно).
export function QuizOverlay({
  question, result, myId, players, onVote,
}: {
  question: QuizQuestionPayload | null;
  result: QuizResultPayload | null;
  myId: string;
  players: PlayerView[];
  onVote: (qid: string, optionId: string) => void;
}) {
  useLang();
  const [now, setNow] = useState(Date.now());
  const [myVote, setMyVote] = useState("");

  // Новый вопрос — сбрасываем свой голос и тикаем отсчёт.
  useEffect(() => {
    if (!question) return;
    setMyVote("");
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [question?.qid]);

  const nameOf = (pid: string) => players.find((p) => p.id === pid)?.name || "?";

  if (question) {
    const left = Math.max(0, Math.ceil((question.endsAt - now) / 1000));
    return (
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.badge}>{t("quiz.badge")}</Text>
            <Text style={styles.timer}>{left}</Text>
          </View>
          <Text style={styles.q}>{question.text}</Text>
          <View style={styles.opts}>
            {question.options.map((o) => {
              const on = myVote === o.id;
              return (
                <Pressable
                  key={o.id}
                  style={({ pressed }) => [styles.opt, on && styles.optOn, pressed && styles.pressed]}
                  onPress={() => { setMyVote(o.id); onVote(question.qid, o.id); }}
                >
                  <Text style={[styles.optText, on && styles.optTextOn]} numberOfLines={2}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{myVote ? t("quiz.voted") : t("quiz.pick")}</Text>
        </View>
      </View>
    );
  }

  if (result) {
    const total = Object.values(result.counts).reduce((s, n) => s + n, 0);
    // кто за какой вариант проголосовал
    const votersOf = (oid: string) =>
      Object.entries(result.votes).filter(([, v]) => v === oid).map(([pid]) => nameOf(pid));
    const ordered = [...result.options].sort(
      (a, b) => (result.counts[b.id] || 0) - (result.counts[a.id] || 0)
    );
    return (
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.badge}>{t("quiz.results")}</Text>
          <Text style={styles.q}>{result.text}</Text>
          {total === 0 ? (
            <Text style={styles.hint}>{t("quiz.noVotes")}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 240 }}>
              {ordered.map((o) => {
                const n = result.counts[o.id] || 0;
                if (n === 0) return null;
                const win = o.id === result.winnerOptionId;
                const voters = votersOf(o.id);
                return (
                  <View key={o.id} style={[styles.res, win && styles.resWin]}>
                    <View style={styles.resTop}>
                      <Text style={[styles.resLabel, win && styles.resLabelWin]} numberOfLines={1}>
                        {win ? "👑 " : ""}{o.label}
                      </Text>
                      <Text style={[styles.resCount, win && styles.resLabelWin]}>{n}</Text>
                    </View>
                    <Text style={styles.voters} numberOfLines={2}>{voters.join(", ")}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <Text style={styles.hint}>{t("quiz.keepFace")}</Text>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  card: {
    width: "100%", maxWidth: 460, backgroundColor: colors.panel2 ?? colors.panel,
    borderWidth: 2, borderColor: colors.accent, borderRadius: 20, padding: 18, gap: 10,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { color: colors.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  timer: { color: colors.accent, fontSize: 26, fontWeight: "900" },
  q: { color: colors.text, fontSize: 20, fontWeight: "800", lineHeight: 26 },
  opts: { gap: 8, marginTop: 4 },
  opt: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  optOn: { borderColor: colors.accent, backgroundColor: "rgba(200,242,80,0.16)" },
  optText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  optTextOn: { color: colors.accent },
  pressed: { transform: [{ scale: 0.98 }] },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 2 },
  res: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginBottom: 8 },
  resWin: { borderColor: colors.accent, backgroundColor: "rgba(200,242,80,0.12)" },
  resTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  resLabel: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 },
  resLabelWin: { color: colors.accent },
  resCount: { color: colors.muted, fontSize: 16, fontWeight: "900" },
  voters: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
