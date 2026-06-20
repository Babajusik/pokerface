import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import type { PlayerView } from "../net/useGame";

// Плитка игрока: имитирует видео-окошко (камеру подключим на Этапе 2).
// Показывает имя, карточки и статус.
export function PlayerTile({
  player,
  isHost,
  isMe,
}: {
  player: PlayerView;
  isHost: boolean;
  isMe: boolean;
}) {
  const border =
    player.cards >= 2 ? colors.red : player.cards === 1 ? colors.yellow : colors.border;

  return (
    <View style={[styles.tile, { borderColor: border, opacity: player.eliminated ? 0.45 : 1 }]}>
      <View style={styles.videoStub}>
        <Text style={styles.videoIcon}>{player.eliminated ? "💀" : "🎥"}</Text>
        {player.cards > 0 && (
          <Text style={styles.cards}>{"🟨".repeat(Math.min(player.cards, 1)) + "🟥".repeat(player.cards >= 2 ? 1 : 0)}</Text>
        )}
      </View>
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {isHost ? "👑 " : ""}
          {player.name}
          {isMe ? " (ты)" : ""}
        </Text>
        {player.ready && !player.eliminated ? <Text style={styles.ready}>✓</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 150,
    margin: 6,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  videoStub: {
    height: 100,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  videoIcon: { fontSize: 34 },
  cards: { position: "absolute", top: 6, right: 8, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", padding: 8, gap: 6 },
  name: { color: colors.text, flex: 1, fontSize: 13, fontWeight: "600" },
  ready: { color: colors.green, fontWeight: "700" },
});
