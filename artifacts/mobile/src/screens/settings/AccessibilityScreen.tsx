import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import {
  useSettingsStore,
  type ColorblindPalette,
} from "../../lib/settings-store";

const FONT_SCALES: Array<1 | 1.15 | 1.3> = [1, 1.15, 1.3];
const PALETTES: ColorblindPalette[] = [
  "off",
  "deuteranopia",
  "protanopia",
  "tritanopia",
];

export function AccessibilityScreen() {
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
            {t("accessibility.eyebrow")}
          </Text>
          <Text variant="displayMd">{t("accessibility.title")}</Text>
        </View>

        <Card>
          <Text variant="titleMd">{t("accessibility.fontScale.title")}</Text>
          <Text tone="muted" style={{ marginTop: 4 }}>
            {t("accessibility.fontScale.hint")}
          </Text>
          <View style={[styles.segment, { marginTop: theme.spacing.md }]}>
            {FONT_SCALES.map((scale) => {
              const selected = s.fontScale === scale;
              return (
                <Pressable
                  key={scale}
                  testID={`fontscale-${scale}`}
                  onPress={() => s.set("fontScale", scale)}
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

        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMd">
                {t("accessibility.highContrast.title")}
              </Text>
              <Text tone="muted" style={{ marginTop: 4 }}>
                {t("accessibility.highContrast.hint")}
              </Text>
            </View>
            <Switch
              testID="accessibility-highcontrast"
              value={s.highContrast}
              onValueChange={(v) => s.set("highContrast", v)}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
            />
          </View>
        </Card>

        <Card>
          <Text variant="titleMd">{t("accessibility.colorblind.title")}</Text>
          <Text tone="muted" style={{ marginTop: 4 }}>
            {t("accessibility.colorblind.hint")}
          </Text>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            {PALETTES.map((p) => {
              const selected = s.colorblindPalette === p;
              return (
                <Pressable
                  key={p}
                  testID={`palette-${p}`}
                  onPress={() => s.set("colorblindPalette", p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.optionRow,
                    {
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.border,
                      borderRadius: theme.radii.sm,
                      padding: theme.spacing.md,
                    },
                  ]}
                >
                  <Text>{t(`accessibility.colorblind.options.${p}`)}</Text>
                  {selected ? <Text tone="muted">✓</Text> : null}
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
  segment: { flexDirection: "row", gap: 8 },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
  },
});
