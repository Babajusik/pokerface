import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "./src/theme";
import { useGame } from "./src/net/useGame";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { GameScreen } from "./src/screens/GameScreen";

export default function App() {
  const game = useGame();
  const { status, snapshot, error, mySessionId, roomId } = game;

  const inRoom = status === "connected";
  const inGame = snapshot.phase === "playing" || snapshot.phase === "game_over";

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {!inRoom ? (
        <HomeScreen
          onJoin={game.connect}
          connecting={status === "connecting"}
          error={error}
        />
      ) : inGame ? (
        <GameScreen
          snapshot={snapshot}
          mySessionId={mySessionId}
          roomId={roomId}
          onSmile={game.smile}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
