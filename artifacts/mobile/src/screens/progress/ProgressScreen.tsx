import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Card, Screen, Text } from "../../components/ui";
import { Spark } from "../../components/charts/Spark";
import { useTheme } from "../../theme";
import {
  PROGRESS_DOMAINS,
  type ProgressSummary,
} from "../../lib/progress-api";

export type ProgressScreenProps = {
  summary?: ProgressSummary;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
};

const DOMAIN_LABELS: Record<string, string> = {
  vocabulary: "Vocabulary",
  writing: "Writing",
  reading: "Reading",
  speaking: "Speaking",
  math: "Math",
  memory: "Memory",
};

const MAX_PROFICIENCY = 5000;

/**
 * Progress (Stats) screen — server-driven dashboard.
 *
 * Pure presentational so it can be smoke-tested with a fixture summary.
 * The route wrapper (`app/(tabs)/stats.tsx`) owns the auth guard +
 * react-query subscription and forwards data in.
 *
 * Anatomy:
 *   - Streak header (current / longest / freezes).
 *   - 30-day completions sparkline.
 *   - 6 domain proficiency bars (Beginner → Expert).
 *   - Lifetime totals row.
 *   - Achievements list (server-computed; client never decides locks).
 */
export function ProgressScreen({
  summary,
  loading,
  error,
  onRetry,
}: ProgressScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (loading && !summary) {
    return (
      <Screen scrollable={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !summary) {
    return (
      <Screen scrollable={false}>
        <View style={styles.center}>
          <Text variant="titleMd">{t("progress.errorTitle")}</Text>
          <Text tone="muted" style={{ marginTop: 8, textAlign: "center" }}>
            {t("progress.errorBody")}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retry,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.colors.primaryFg }}>
              {t("progress.retry")}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const s = summary!;
  const dailyValues = s.dailyCompletions.map((d) => d.count);
  const totalLast30 = dailyValues.reduce((a, b) => a + b, 0);

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View>
          <Text variant="caption" tone="muted">
            {t("progress.subtitle")}
          </Text>
          <Text variant="displayMd">{t("progress.title")}</Text>
        </View>

        {/* Streak summary */}
        <Card>
          <View style={styles.streakRow}>
            <View style={styles.streakCell}>
              <Text variant="caption" tone="muted">
                {t("progress.streak.current")}
              </Text>
              <Text variant="displayLg">{s.streak.current}</Text>
            </View>
            <View style={styles.streakCell}>
              <Text variant="caption" tone="muted">
                {t("progress.streak.longest")}
              </Text>
              <Text variant="titleLg">{s.streak.longest}</Text>
            </View>
            <View style={styles.streakCell}>
              <Text variant="caption" tone="muted">
                {t("progress.streak.freezes")}
              </Text>
              <Text variant="titleLg">{s.streak.freezesAvailable}</Text>
            </View>
          </View>
        </Card>

        {/* 30-day spark */}
        <Card>
          <View style={styles.sparkHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                {t("progress.last30Days")}
              </Text>
              <Text variant="titleMd">
                {totalLast30} {t("progress.gamesSuffix")}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: theme.spacing.md }}>
            <Spark
              testID="progress-spark"
              values={dailyValues}
              width={300}
              height={60}
            />
          </View>
        </Card>

        {/* Proficiency bars */}
        <Card>
          <Text variant="titleMd">{t("progress.proficiency.title")}</Text>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
            {PROGRESS_DOMAINS.map((domain) => {
              const score = s.proficiency[domain] ?? 0;
              const band = s.bands[domain] ?? "Beginner";
              const pct = Math.max(
                0,
                Math.min(1, score / MAX_PROFICIENCY),
              );
              return (
                <View
                  key={domain}
                  testID={`prof-${domain}`}
                  accessibilityLabel={`${DOMAIN_LABELS[domain]} ${band}`}
                >
                  <View style={styles.barLabelRow}>
                    <Text variant="label">{DOMAIN_LABELS[domain]}</Text>
                    <Text variant="caption" tone="muted">
                      {band}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.barTrack,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderRadius: theme.radii.pill,
                      },
                    ]}
                  >
                    <View
                      testID={`prof-fill-${domain}`}
                      style={{
                        width: `${pct * 100}%`,
                        height: "100%",
                        backgroundColor: theme.colors.primary,
                        borderRadius: theme.radii.pill,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Totals */}
        <Card>
          <View style={styles.totalsRow}>
            <View style={styles.totalCell}>
              <Text variant="caption" tone="muted">
                {t("progress.totals.workouts")}
              </Text>
              <Text variant="titleLg">{s.totals.workoutsCompleted}</Text>
            </View>
            <View style={styles.totalCell}>
              <Text variant="caption" tone="muted">
                {t("progress.totals.games")}
              </Text>
              <Text variant="titleLg">{s.totals.gamesCompleted}</Text>
            </View>
          </View>
        </Card>

        {/* Achievements */}
        <View>
          <Text variant="titleMd" style={{ marginBottom: theme.spacing.sm }}>
            {t("progress.achievements.title")}
          </Text>
          {s.achievements.length === 0 ? (
            <Card>
              <Text tone="muted">{t("progress.achievements.empty")}</Text>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {s.achievements.map((a) => (
                <Card key={a.id} testID={`achievement-${a.id}`} padding="md">
                  <Text variant="label">{a.title}</Text>
                  <Text variant="caption" tone="muted">
                    {a.description}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  retry: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  streakRow: { flexDirection: "row", justifyContent: "space-between" },
  streakCell: { flex: 1, gap: 2 },
  sparkHeader: { flexDirection: "row", alignItems: "center" },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barTrack: {
    height: 10,
    width: "100%",
    overflow: "hidden",
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between" },
  totalCell: { flex: 1, gap: 2 },
});
