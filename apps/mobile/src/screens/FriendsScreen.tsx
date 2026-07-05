import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { colors } from "../theme";
import { t, useLang } from "../i18n";
import {
  ensureRegistered, listFriends, addFriend, respondRequest, removeFriend,
  getIdentity, type FriendsData, type Friend, type AddResult,
} from "../net/friends";

export function FriendsScreen({ name, onBack }: { name: string; onBack: () => void }) {
  useLang();
  const [ready, setReady] = useState(false);
  const [myCode, setMyCode] = useState(getIdentity()?.code ?? "");
  const [data, setData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [addCode, setAddCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const d = await listFriends();
      if (mounted.current) setData(d);
    } catch {}
  }, []);

  // регистрация + первичная загрузка + опрос
  useEffect(() => {
    mounted.current = true;
    let iv: any;
    (async () => {
      if (!name.trim()) { setLoading(false); return; }
      try {
        const id = await ensureRegistered(name.trim());
        if (!mounted.current) return;
        setMyCode(id.code);
        setReady(true);
        await refresh();
      } catch {
        if (mounted.current) setMsg({ text: t("friends.error"), err: true });
      } finally {
        if (mounted.current) setLoading(false);
      }
      iv = setInterval(refresh, 6000);
    })();
    return () => { mounted.current = false; if (iv) clearInterval(iv); };
  }, [name, refresh]);

  function flash(text: string, err?: boolean) {
    setMsg({ text, err });
    setTimeout(() => mounted.current && setMsg(null), 2500);
  }

  function copyCode() {
    try {
      (navigator as any)?.clipboard?.writeText(myCode);
      setCopied(true);
      setTimeout(() => mounted.current && setCopied(false), 2000);
    } catch {}
  }

  async function onAdd() {
    const code = addCode.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      const r: AddResult = await addFriend(code);
      const texts: Record<AddResult, string> = {
        requested: t("friends.added"),
        friends: t("friends.nowFriends"),
        self: t("friends.selfCode"),
        notfound: t("friends.notFound"),
        already: t("friends.added"),
      };
      flash(texts[r], r === "self" || r === "notfound");
      if (r === "requested" || r === "friends" || r === "already") setAddCode("");
      await refresh();
    } catch {
      flash(t("friends.error"), true);
    } finally {
      setBusy(false);
    }
  }

  async function onAccept(f: Friend, accept: boolean) {
    try { await respondRequest(f.id, accept); await refresh(); } catch { flash(t("friends.error"), true); }
  }
  async function onRemove(f: Friend) {
    try { await removeFriend(f.id); await refresh(); } catch { flash(t("friends.error"), true); }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>{t("common.back")}</Text></Pressable>
        <Text style={styles.title}>{t("friends.title")}</Text>
        <View style={{ width: 60 }} />
      </View>

      {!name.trim() ? (
        <Text style={styles.hint}>{t("friends.needName")}</Text>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* Мой код */}
          <View style={styles.card}>
            <Text style={styles.label}>{t("friends.myCode")}</Text>
            <View style={styles.codeRow}>
              <Text style={styles.code}>{myCode || "—"}</Text>
              <Pressable style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]} onPress={copyCode} disabled={!myCode}>
                <Text style={styles.copyText}>{copied ? t("friends.codeCopied") : t("friends.copyCode")}</Text>
              </Pressable>
            </View>
          </View>

          {/* Добавить по коду */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder={t("friends.addPlaceholder")}
              placeholderTextColor={colors.muted}
              value={addCode}
              onChangeText={(s) => setAddCode(s.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
            />
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.pressed, (!addCode.trim() || busy) && styles.disabled]} disabled={!addCode.trim() || busy} onPress={onAdd}>
              <Text style={styles.addText}>{t("friends.add")}</Text>
            </Pressable>
          </View>
          {msg && <Text style={[styles.msg, msg.err && styles.msgErr]}>{msg.text}</Text>}

          {/* Входящие заявки */}
          {data.incoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("friends.incoming")} · {data.incoming.length}</Text>
              {data.incoming.map((f) => (
                <View key={f.id} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1}>{f.nickname || f.code}</Text>
                  <Pressable style={({ pressed }) => [styles.smallBtn, styles.acceptBtn, pressed && styles.pressed]} onPress={() => onAccept(f, true)}>
                    <Text style={styles.acceptText}>{t("friends.accept")}</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]} onPress={() => onAccept(f, false)}>
                    <Text style={styles.rejectText}>{t("friends.reject")}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Друзья */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("friends.listTitle")} · {data.friends.length}</Text>
            {data.friends.length === 0 ? (
              <Text style={styles.hint}>{t("friends.empty")}</Text>
            ) : data.friends.map((f) => (
              <View key={f.id} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={1}>{f.nickname || f.code}</Text>
                <Text style={styles.rowCode}>{f.code}</Text>
                <Pressable style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]} onPress={() => onRemove(f)}>
                  <Text style={styles.rejectText}>{t("friends.remove")}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Отправленные */}
          {data.outgoing.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("friends.outgoing")} · {data.outgoing.length}</Text>
              {data.outgoing.map((f) => (
                <View key={f.id} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1}>{f.nickname || f.code}</Text>
                  <Text style={styles.rowCode}>{t("friends.pending")}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { paddingVertical: 6, width: 60 },
  backText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { gap: 14, paddingBottom: 40, maxWidth: 480, width: "100%", alignSelf: "center" },

  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  code: { color: colors.accent, fontSize: 30, fontWeight: "900", letterSpacing: 4, flex: 1 },
  copyBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  copyText: { color: colors.accent, fontSize: 14, fontWeight: "700" },

  addRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, color: colors.text, fontSize: 16, letterSpacing: 2 },
  addBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  addText: { color: colors.onAccent, fontSize: 16, fontWeight: "800" },
  msg: { color: colors.accent, fontSize: 14, textAlign: "center" },
  msgErr: { color: colors.red },

  section: { gap: 8 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  rowCode: { color: colors.muted, fontSize: 13, letterSpacing: 1 },
  smallBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  acceptBtn: { backgroundColor: colors.accent, borderColor: colors.accent },
  acceptText: { color: colors.onAccent, fontSize: 13, fontWeight: "800" },
  rejectText: { color: colors.muted, fontSize: 13, fontWeight: "700" },

  hint: { color: colors.muted, textAlign: "center", fontSize: 14, paddingVertical: 12 },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
});
