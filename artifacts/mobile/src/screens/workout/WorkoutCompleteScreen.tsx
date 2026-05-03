import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import type {
  ProficiencyDelta,
  StreakSummary,
} from "../../lib/workout-api";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type WorkoutCompleteScreenProps = {
  streak: StreakSummary;
  proficiencyDeltas: ReadonlyArray<ProficiencyDelta>;
  onDone: () => void;
};

/**
 * Celebration screen shown right after a workout completes. Surfaces:
 *   - The new streak (current + longest if it just beat the record).
 *   - Per-domain proficiency deltas — positive deltas in the brand
 *     accent, negatives in muted/danger so a regression is visible
 *     without being alarmist.
 */
export function WorkoutCompleteScreen({
  streak,
  proficiencyDeltas,
  onDone,
}: WorkoutCompleteScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const newRecord = streak.current > 0 && streak.current === streak.longest;

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: theme.spacing.sm, alignItems: "center" }}>
          <Text variant="caption" tone="muted">
            {t("complete.eyebrow")}
          </Text>
          <Text variant="displayLg" style={{ textAlign: "center" }}>
            {t("complete.title")}
          </Text>
          <Text
            variant="body"
            tone="muted"
            style={{ textAlign: "center" }}
          >
            {t("complete.subtitle")}
          </Text>
        </View>

        <Card>
          <View style={styles.streakRow}>
            <View>
              <Text variant="caption" tone="muted">
                {t("complete.streakCurrent")}
              </Text>
              <Text variant="displayMd">{streak.current}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="caption" tone="muted">
                {t("complete.streakBest")}
              </Text>
              <Text variant="titleMd">{streak.longest}</Text>
            </View>
          </View>
          {newRecord ? (
            <Text
              variant="caption"
              style={{ color: theme.colors.primary, marginTop: 8 }}
            >
              {t("complete.newRecord")}
            </Text>
          ) : null}
        </Card>

        {proficiencyDeltas.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" tone="muted">
              {t("complete.deltasHeading")}
            </Text>
            <View style={{ gap: theme.spacing.sm }}>
              {proficiencyDeltas.map((d) => {
                const positive = d.delta > 0;
                const color = positive
                  ? theme.colors.primary
                  : d.delta < 0
                    ? theme.colors.danger
                    : theme.colors.text;
                const sign = positive ? "+" : "";
                return (
                  <Card key={d.domain}>
                    <View style={styles.deltaRow}>
                      <Text variant="titleMd">{d.domain}</Text>
                      <Text variant="titleMd" style={{ color }}>
                        {sign}
                        {d.delta}
                      </Text>
                    </View>
                    <Text variant="caption" tone="muted">
                      {t("complete.deltaScore", { score: d.score })}
                    </Text>
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}

        <Button label={t("complete.done")} fullWidth onPress={onDone} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
});
