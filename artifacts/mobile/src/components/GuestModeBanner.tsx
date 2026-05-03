import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "./ui";
import { useTheme } from "../theme";
import { useAuthStore } from "../lib/auth-store";

/**
 * Persistent banner shown while the user is in guest mode (no `user` in the
 * auth store). Tapping it routes to the registration screen so guest
 * progress can be promoted to a real account (FR-1.4).
 *
 * Renders nothing once a user is signed in — placement code (e.g. tab
 * layout) does not need to conditionally mount it.
 */
export function GuestModeBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  if (user) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("guestBanner.cta")}
      onPress={() => router.push("/onboarding/register")}
      style={({ pressed }) => [
        styles.wrap,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderBottomColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <Text variant="bodySm" style={{ flex: 1, color: theme.colors.text }}>
          {t("guestBanner.message")}
        </Text>
        <Text variant="label" style={{ color: theme.colors.primary }}>
          {t("guestBanner.cta")}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
