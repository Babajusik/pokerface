import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PlayerTile } from "../components/PlayerTile";
import { colors } from "../theme";
import type { PlayerView } from "../net/useGame";

// Native-заглушка: на телефоне видео LiveKit подключим в dev build (нужен
// @livekit/react-native + react-native-webrtc). Пока показываем плитки игроков.

export function LiveKitVideo({
  players,
  identity,
  hostId,
}: {
  roomName: string;
  identity: string;
  name: string;
  players: PlayerView[];
  hostId: string;
  detectActive?: boolean;
  onSmile?: () => void;
}) {
  return (
    <View>
      <Text style={styles.note}>📹 Видео на телефоне — в dev build (Этап 2b)</Text>
      <View style={styles.grid}>
        {players.map((p) => (
          <PlayerTile
            key={p.id}
            player={p}
            isHost={p.id === hostId}
            isMe={p.id === identity}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  note: { color: colors.muted, textAlign: "center", marginBottom: 6, fontSize: 12 },
});
