import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import { useSettingsStore } from "../../lib/settings-store";

const TIMER_SCALES: Array<1 | 1.5 | 2> = [1, 1.5, 2];

export function PreferencesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const s = useSettingsStore();

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
            {t("preferences.eyebrow")}
          </Text>
          <Text variant="displayMd">{t("preferences.title")}</Text>
        </View>

        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMd">{t("preferences.relaxed.title")}</Text>
              <Text tone="muted" style={{ marginTop: 4 }}>
                {t("preferences.relaxed.hint")}
              </Text>
            </View>
            <Switch
              testID="preferences-relaxed"
              value={s.relaxedMode}
              onValueChange={(v) => s.set("relaxedMode", v)}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
            />
          </View>
        </Card>

        <Card>
          <Text variant="titleMd">{t("preferences.timer.title")}</Text>
          <Text tone="muted" style={{ marginTop: 4 }}>
            {t("preferences.timer.hint")}
          </Text>
          <View style={[styles.segment, { marginTop: theme.spacing.md }]}>
            {TIMER_SCALES.map((scale) => {
              const selected = s.timerScale === scale;
              return (
                <Pressable
                  key={scale}
                  testID={`timer-${scale}`}
                  onPress={() => s.set("timerScale", scale)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.segmentItem,
                    {
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.border,
                      backgroundColor: selected
                        ? `${theme.colors.primary}22`
                        : "transparent",
                      borderRadius: theme.radii.sm,
                    },
                  ]}
                >
                  <Text>{scale}×</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
  },
});
