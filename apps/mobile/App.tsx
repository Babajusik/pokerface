import React, { useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "./src/theme";
import { useGame } from "./src/net/useGame";
import { getSettings, saveSettings } from "./src/settings";
import { MainMenuScreen } from "./src/screens/MainMenuScreen";
import { CreateGameScreen } from "./src/screens/CreateGameScreen";
import { LobbyListScreen } from "./src/screens/LobbyListScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { GameScreen } from "./src/screens/GameScreen";

type Route = "menu" | "create" | "list" | "settings";

export default function App() {
  const game = useGame();
  const { status, snapshot, error, mySessionId, roomId } = game;
  const [route, setRoute] = useState<Route>("menu");
  const [name, setName] = useState(getSettings().name);

  const inRoom = status === "connected";
  const inGame = snapshot.phase === "playing" || snapshot.phase === "game_over";
  const connecting = status === "connecting";

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
    content = inGame ? (
      <GameScreen
        snapshot={snapshot}
        mySessionId={mySessionId}
        roomId={roomId}
        taunt={game.taunt}
        itemEffect={game.itemEffect}
        onSmile={game.smile}
        onUseItem={game.useItem}
        onRematch={game.rematch}
        onLeave={game.leave}
      />
    ) : (
      <LobbyScreen
        snapshot={snapshot}
        mySessionId={mySessionId}
        roomId={roomId}
        onReady={game.setReady}
        onStart={game.startGame}
        onLeave={game.leave}
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
        onNameChange={setNamePersist}
        onQuickPlay={() => game.quickPlay(name)}
        onCreate={() => setRoute("create")}
        onFind={() => setRoute("list")}
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
          <Text style={styles.overlayText}>Подключение…</Text>
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
