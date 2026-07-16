import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "./src/theme";
import { useGame } from "./src/net/useGame";
import { t, useLang } from "./src/i18n";
import { getSettings, saveSettings } from "./src/settings";
import { ping } from "./src/net/friends";
import { checkUpdate, applyUpdate, versionCheckEnabled } from "./src/version";
import { MainMenuScreen } from "./src/screens/MainMenuScreen";
import { CreateGameScreen } from "./src/screens/CreateGameScreen";
import { LobbyListScreen } from "./src/screens/LobbyListScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { RoomScreen } from "./src/screens/RoomScreen";

type Route = "menu" | "create" | "list" | "settings" | "friends";

export default function App() {
  useLang();
  const game = useGame();
  const { status, snapshot, error, mySessionId, roomId } = game;
  const [route, setRoute] = useState<Route>("menu");
  const [name, setName] = useState(getSettings().name);

  const inRoom = status === "connected";
  const connecting = status === "connecting";

  // Зашли в комнату → сбрасываем маршрут на меню, чтобы после выхода вернуться в меню,
  // а не на устаревший экран Создать/Найти.
  useEffect(() => {
    if (status === "connected") setRoute("menu");
  }, [status]);

  // Онлайн-пинг, пока приложение открыто (если игрок зарегистрирован в друзьях).
  useEffect(() => {
    ping();
    const iv = setInterval(ping, 20000);
    return () => clearInterval(iv);
  }, []);

  // ── Актуальность версии ──
  // Проверяем при старте, по возврату фокуса и раз в 5 минут.
  const [update, setUpdate] = useState<{ version: string; canAutoApply: boolean } | null>(null);
  useEffect(() => {
    if (!versionCheckEnabled) return; // dev-сборка (metro) — не проверяем
    let stopped = false;
    const check = async () => {
      const u = await checkUpdate();
      if (u && !stopped) setUpdate(u);
    };
    check();
    const iv = setInterval(check, 5 * 60 * 1000);
    const onFocus = () => check();
    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      clearInterval(iv);
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Обновляемся молча, когда безопасно (в меню). Из матча не выдёргиваем —
  // применится сразу после выхода из комнаты.
  useEffect(() => {
    if (update?.canAutoApply && !inRoom) applyUpdate(update.version);
  }, [update, inRoom]);

  function setNamePersist(n: string) {
    setName(n);
    saveSettings({ name: n });
  }
  function backToMenu() {
    game.reset();
    setRoute("menu");
  }

  let content: React.ReactNode;
  if (inRoom) {
    content = (
      <RoomScreen
        snapshot={snapshot}
        mySessionId={mySessionId}
        roomId={roomId}
        taunt={game.taunt}
        itemEffect={game.itemEffect}
        onReady={game.setReady}
        onStart={game.startGame}
        onSmile={game.smile}
        onUseItem={game.useItem}
        onRematch={game.rematch}
        onLeave={game.leave}
        onMediaReady={game.setMediaReady}
        onFace={game.reportFace}
        smileLevels={game.smileLevels}
        onSetJudge={game.setJudge}
        onSmileLevel={game.sendSmileLevel}
        onJudgeCard={game.judgeCard}
        sendBoardOp={game.sendBoardOp}
        subscribeBoard={game.subscribeBoard}
        quizQuestion={game.quizQuestion}
        quizResult={game.quizResult}
        onQuizVote={game.sendQuizVote}
      />
    );
  } else if (route === "create") {
    content = (
      <CreateGameScreen
        defaultName={name}
        connecting={connecting}
        error={error}
        onBack={backToMenu}
        onCreate={(o) => game.createGame(name, o)}
      />
    );
  } else if (route === "list") {
    content = (
      <LobbyListScreen
        connecting={connecting}
        error={error}
        onBack={backToMenu}
        onJoinById={(id) => game.joinById(id, name)}
        onJoinByCode={(c) => game.joinByCode(c, name)}
      />
    );
  } else if (route === "settings") {
    content = (
      <SettingsScreen
        onBack={() => {
          setName(getSettings().name);
          setRoute("menu");
        }}
      />
    );
  } else if (route === "friends") {
    content = <FriendsScreen name={name} onBack={() => setRoute("menu")} />;
  } else {
    content = (
      <MainMenuScreen
        name={name}
        error={error}
        onNameChange={setNamePersist}
        onQuickPlay={() => game.quickPlay(name)}
        onCreate={() => { game.reset(); setRoute("create"); }}
        onFind={() => { game.reset(); setRoute("list"); }}
        onJoinRoom={(room) => game.joinById(room, name)}
        onFriends={() => setRoute("friends")}
        onSettings={() => setRoute("settings")}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {content}
      {connecting && !inRoom && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.overlayText}>{t("app.connecting")}</Text>
        </View>
      )}
      {/* В матче не выдёргиваем — только предупреждаем; обновится после выхода */}
      {update && inRoom && (
        <View style={styles.updateBanner} pointerEvents="none">
          <Text style={styles.updateText}>{t("app.updateAfterExit")}</Text>
        </View>
      )}
      {status === "reconnecting" && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.overlayText}>{t("app.reconnecting")}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(11,13,18,0.7)", alignItems: "center", justifyContent: "center", gap: 12,
  },
  overlayText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  updateBanner: { position: "absolute", bottom: 8, left: 12, right: 12, alignItems: "center" },
  updateText: {
    backgroundColor: colors.panel2 ?? colors.panel, color: colors.accent,
    borderWidth: 1, borderColor: colors.accent, borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 14, fontSize: 12, fontWeight: "700", overflow: "hidden",
  },
});
