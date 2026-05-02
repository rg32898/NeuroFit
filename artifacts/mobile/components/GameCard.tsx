import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export interface GameCardProps {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  accentColor: string;
  bestScore: number;
  difficulty: 1 | 2 | 3;
  compact?: boolean;
}

export function GameCard({
  id,
  name,
  description,
  icon,
  accentColor,
  bestScore,
  difficulty,
  compact = false,
}: GameCardProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/game/${id}` as never);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          opacity: pressed ? 0.82 : 1,
          padding: compact ? 12 : 16,
          marginBottom: compact ? 8 : 12,
        },
      ]}
    >
      <View
        style={[
          styles.iconBg,
          {
            backgroundColor: accentColor + "26",
            borderRadius: colors.radius - 4,
            width: compact ? 40 : 48,
            height: compact ? 40 : 48,
          },
        ]}
      >
        <Feather name={icon} size={compact ? 18 : 22} color={accentColor} />
      </View>

      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            { color: colors.foreground, fontSize: compact ? 14 : 16 },
          ]}
        >
          {name}
        </Text>
        {!compact && (
          <Text
            style={[styles.desc, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {description}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={[styles.score, { color: accentColor }]}>
            {bestScore > 0 ? `Best: ${bestScore}` : "Not played"}
          </Text>
          <View style={styles.dots}>
            {[1, 2, 3].map((d) => (
              <View
                key={d}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      d <= difficulty ? accentColor : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBg: {
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  desc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  score: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  dots: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
