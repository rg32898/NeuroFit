import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
}

export function StatCard({ label, value, unit, icon, iconColor }: StatCardProps) {
  const colors = useColors();
  const color = iconColor ?? colors.primary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderRadius: colors.radius },
      ]}
    >
      <View
        style={[
          styles.iconBg,
          { backgroundColor: color + "26", borderRadius: 10 },
        ]}
      >
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>
        {value}
        {unit ? (
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>
            {" "}
            {unit}
          </Text>
        ) : null}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    alignItems: "flex-start",
    gap: 8,
  },
  iconBg: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
  unit: {
    fontSize: 13,
    fontWeight: "400",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
