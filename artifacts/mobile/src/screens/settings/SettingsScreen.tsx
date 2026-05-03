import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type SettingsRowSpec = {
  id: string;
  label: string;
  hint?: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
};

export type SettingsScreenProps = {
  email: string | null;
  onAccount: () => void;
  onSubscription: () => void;
  onPreferences: () => void;
  onAccessibility: () => void;
  onNotifications: () => void;
  onSupport: () => void;
  onLegalPrivacy: () => void;
  onLegalTerms: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

/**
 * Pure presentational settings screen. The route file at
 * `app/(tabs)/profile.tsx` injects navigation handlers.
 *
 * Trust-layer requirement: "Manage subscription" is a single tap from
 * here, and SubscriptionStatusScreen exposes Cancel — so cancellation
 * is reachable in <= 2 taps from the tab bar (FR-6.5 / FR-6.6).
 */
export function SettingsScreen(props: SettingsScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const sections: { title: string; rows: SettingsRowSpec[] }[] = [
    {
      title: t("settings.sections.account"),
      rows: [
        {
          id: "subscription",
          label: t("settings.rows.subscription"),
          hint: t("settings.rows.subscriptionHint"),
          icon: "credit-card",
          onPress: props.onSubscription,
          testID: "settings-row-subscription",
        },
        {
          id: "account",
          label: t("settings.rows.account"),
          hint: props.email ?? t("settings.rows.accountHintGuest"),
          icon: "user",
          onPress: props.onAccount,
          testID: "settings-row-account",
        },
      ],
    },
    {
      title: t("settings.sections.app"),
      rows: [
        {
          id: "preferences",
          label: t("settings.rows.preferences"),
          hint: t("settings.rows.preferencesHint"),
          icon: "sliders",
          onPress: props.onPreferences,
          testID: "settings-row-preferences",
        },
        {
          id: "notifications",
          label: t("settings.rows.notifications"),
          hint: t("settings.rows.notificationsHint"),
          icon: "bell",
          onPress: props.onNotifications,
          testID: "settings-row-notifications",
        },
        {
          id: "accessibility",
          label: t("settings.rows.accessibility"),
          hint: t("settings.rows.accessibilityHint"),
          icon: "eye",
          onPress: props.onAccessibility,
          testID: "settings-row-accessibility",
        },
      ],
    },
    {
      title: t("settings.sections.help"),
      rows: [
        {
          id: "support",
          label: t("settings.rows.support"),
          icon: "help-circle",
          onPress: props.onSupport,
          testID: "settings-row-support",
        },
        {
          id: "privacy",
          label: t("settings.rows.privacy"),
          icon: "shield",
          onPress: props.onLegalPrivacy,
        },
        {
          id: "terms",
          label: t("settings.rows.terms"),
          icon: "file-text",
          onPress: props.onLegalTerms,
        },
      ],
    },
    {
      title: t("settings.sections.danger"),
      rows: [
        {
          id: "signout",
          label: t("settings.rows.signOut"),
          icon: "log-out",
          onPress: props.onSignOut,
          testID: "settings-row-signout",
        },
        {
          id: "delete",
          label: t("settings.rows.deleteAccount"),
          icon: "trash-2",
          onPress: props.onDeleteAccount,
          destructive: true,
          testID: "settings-row-delete",
        },
      ],
    },
  ];

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text variant="caption" tone="muted">
            {t("settings.subtitle")}
          </Text>
          <Text variant="displayMd">{t("settings.title")}</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" tone="muted" style={styles.sectionTitle}>
              {section.title.toUpperCase()}
            </Text>
            <Card padding="none">
              {section.rows.map((row, idx) => (
                <Pressable
                  key={row.id}
                  testID={row.testID}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomWidth:
                        idx < section.rows.length - 1
                          ? StyleSheet.hairlineWidth
                          : 0,
                      borderBottomColor: theme.colors.border,
                      padding: theme.spacing.md,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.icon,
                      {
                        backgroundColor: row.destructive
                          ? `${theme.colors.danger}22`
                          : `${theme.colors.primary}22`,
                        borderRadius: theme.radii.sm,
                      },
                    ]}
                  >
                    <Feather
                      name={row.icon}
                      size={16}
                      color={
                        row.destructive
                          ? theme.colors.danger
                          : theme.colors.primary
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="body"
                      style={{
                        color: row.destructive
                          ? theme.colors.danger
                          : theme.colors.text,
                      }}
                    >
                      {row.label}
                    </Text>
                    {row.hint ? (
                      <Text variant="caption" tone="muted">
                        {row.hint}
                      </Text>
                    ) : null}
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { letterSpacing: 1.2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
