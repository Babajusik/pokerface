import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

// Native-заглушка детектора улыбки.
//
// Полноценный детект на iOS/Android = react-native-vision-camera + frame
// processor с ML Kit Face Detection (smilingProbability) -> SmileDetector.
// Это требует dev build (не Expo Go) и config-плагинов. Реализуем в Этапе 1b.
// Пока на телефоне доступна DEV-кнопка «Улыбнуться» в GameScreen.

export function CameraSmile({ active }: { active: boolean; onSmile: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📷</Text>
      <Text style={styles.text}>
        Детект с камеры на телефоне появится в dev build (Этап 1b).
        Пока используй кнопку «Улыбнуться» ниже.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 240,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    alignItems: "center",
    gap: 6,
  },
  icon: { fontSize: 28 },
  text: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
