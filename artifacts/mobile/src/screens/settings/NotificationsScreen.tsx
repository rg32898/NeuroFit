import React from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import { useSettingsStore } from "../../lib/settings-store";

/**
 * FR-8.3 — single master toggle disables everything.
 * FR-8.4 — Marketing toggle defaults to OFF; the backend's sendEmail
 *          guard refuses marketing sends without an explicit opt-in.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = useSettingsStore();

  const disabled = !s.notificationsMaster;

  const Row = ({
    testID,
    label,
    hint,
    value,
    onValueChange,
    rowDisabled,
  }: {
    testID: string;
    label: string;
    hint?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    rowDisabled?: boolean;
  }) => (
    <View
      style={[
        styles.row,
        {
          paddingVertical: theme.spacing.md,
          opacity: rowDisabled ? 0.4 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={rowDisabled}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
      />
    </View>
  );

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          paddingBottom: 200,
        }}
      >
        <View>
          <Text variant="caption" tone="muted">
            {t("notifications.eyebrow")}
          </Text>
          <Text variant="displayMd">{t("notifications.title")}</Text>
        </View>

        <Card padding="md">
          <Row
            testID="notifications-master"
            label={t("notifications.master.label")}
            hint={t("notifications.master.hint")}
            value={s.notificationsMaster}
            onValueChange={(v) => s.set("notificationsMaster", v)}
          />
        </Card>

        <Card padding="md">
          <Row
            testID="notifications-daily"
            label={t("notifications.daily.label")}
            hint={t("notifications.daily.hint", {
              hour: String(s.dailyReminderHour).padStart(2, "0"),
              minute: String(s.dailyReminderMinute).padStart(2, "0"),
            })}
            value={s.dailyReminderEnabled}
            onValueChange={(v) => s.set("dailyReminderEnabled", v)}
            rowDisabled={disabled}
          />
        </Card>

        <Card padding="md">
          <Row
            testID="notifications-quiet"
            label={t("notifications.quiet.label")}
            hint={t("notifications.quiet.hint", {
              start: String(s.quietHoursStartHour).padStart(2, "0"),
              end: String(s.quietHoursEndHour).padStart(2, "0"),
            })}
            value={s.quietHoursEnabled}
            onValueChange={(v) => s.set("quietHoursEnabled", v)}
            rowDisabled={disabled}
          />
        </Card>

        <Card padding="md">
          <Row
            testID="notifications-marketing"
            label={t("notifications.marketing.label")}
            hint={t("notifications.marketing.hint")}
            value={s.marketingOptIn}
            onValueChange={(v) => s.set("marketingOptIn", v)}
            rowDisabled={disabled}
          />
        </Card>

        <Text variant="caption" tone="muted">
          {t("notifications.footnote")}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
