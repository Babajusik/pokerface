import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "./src/theme";
import { useGame } from "./src/net/useGame";
import { t, useLang } from "./src/i18n";
import { getSettings, saveSettings } from "./src/settings";
import { MainMenuScreen } from "./src/screens/MainMenuScreen";
import { CreateGameScreen } from "./src/screens/CreateGameScreen";
import { LobbyListScreen } from "./src/screens/LobbyListScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { RoomScreen } from "./src/screens/RoomScreen";

type Route = "menu" | "create" | "list" | "settings";

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
  } else {
    content = (
      <MainMenuScreen
        name={name}
        error={error}
        onNameChange={setNamePersist}
        onQuickPlay={() => game.quickPlay(name)}
        onCreate={() => { game.reset(); setRoute("create"); }}
        onFind={() => { game.reset(); setRoute("list"); }}
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
});
