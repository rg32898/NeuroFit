import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import type {
  PlannedGame,
  StreakResponse,
  WorkoutTodayResponse,
} from "../../lib/workout-api";
import type { TimerScale } from "../../lib/timer-scale-store";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type TodayScreenProps = {
  workout?: WorkoutTodayResponse;
  streak?: StreakResponse;
  loading: boolean;
  error: Error | null;
  /** Current relaxed-mode timer scale (1, 1.5, or 2). */
  relaxedScale: TimerScale;
  onStartWorkout: (workoutId: string) => void;
  onOpenRelaxedPicker: () => void;
  onFreePlay: () => void;
  onRetry: () => void;
};

/**
 * Today tab — the daily core loop entry point.
 *
 * Pure presentational: hooks, queries, navigation are all wired in the
 * route wrapper so this file is trivially testable with mocked props.
 *
 * Anatomy:
 *   - Header: today's date, current streak badge, Relaxed-mode indicator
 *     (tap → picker).
 *   - Game cards: one per planned game, in the planned order.
 *   - Primary CTA: "Start workout".
 *   - Below the fold: "Free play" link to the Games tab.
 */
export function TodayScreen({
  workout,
  streak,
  loading,
  error,
  relaxedScale,
  onStartWorkout,
  onOpenRelaxedPicker,
  onFreePlay,
  onRetry,
}: TodayScreenProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const dateLabel = formatDate(workout?.session.date, i18n.language);
  const games: PlannedGame[] = workout?.session.gamesPlanned ?? [];

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              {dateLabel}
            </Text>
            <Text variant="displayMd">{t("today.title")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("relaxed.indicatorLabel", {
              scale: relaxedScale,
            })}
            onPress={onOpenRelaxedPicker}
            style={({ pressed }) => [
              styles.relaxedPill,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text variant="label" style={{ color: theme.colors.text }}>
              {t("relaxed.indicator", { scale: relaxedScale })}
            </Text>
          </Pressable>
        </View>

        {/* Streak */}
        <Card>
          <View style={styles.streakRow}>
            <View>
              <Text variant="caption" tone="muted">
                {t("today.streakLabel")}
              </Text>
              <Text variant="displayLg">{streak?.current ?? 0}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="caption" tone="muted">
                {t("today.streakBest")}
              </Text>
              <Text variant="titleMd">{streak?.longest ?? 0}</Text>
            </View>
          </View>
        </Card>

        {/* Loading / error states */}
        {loading ? (
          <Card>
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator />
              <Text
                variant="caption"
                tone="muted"
                style={{ marginTop: theme.spacing.sm }}
              >
                {t("today.loading")}
              </Text>
            </View>
          </Card>
        ) : error ? (
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Text variant="titleMd">{t("today.errorTitle")}</Text>
              <Text variant="body" tone="muted">
                {t("today.errorBody")}
              </Text>
              <Button
                label={t("common.retry")}
                onPress={onRetry}
                fullWidth
              />
            </View>
          </Card>
        ) : (
          <>
            {/* Game cards */}
            <Text variant="caption" tone="muted">
              {t("today.gamesHeading")}
            </Text>
            <View style={{ gap: theme.spacing.md }}>
              {games.map((game, idx) => (
                <Card key={game.gameId}>
                  <View style={styles.gameRow}>
                    <View style={styles.indexBubble}>
                      <Text
                        variant="label"
                        style={{ color: theme.colors.primary }}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMd">{game.title}</Text>
                      <Text variant="caption" tone="muted">
                        {t("today.gameMeta", {
                          domain: game.domain,
                          seconds: game.averageDurationSec,
                        })}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>

            {/* Primary CTA */}
            <Button
              label={
                workout?.session.completedAt
                  ? t("today.completedCta")
                  : t("today.startCta")
              }
              fullWidth
              disabled={!workout || games.length === 0}
              onPress={() => {
                if (workout) onStartWorkout(workout.session.id);
              }}
            />
          </>
        )}

        {/* Below the fold: Free play */}
        <View style={{ alignItems: "center", marginTop: theme.spacing.xl }}>
          <Button
            label={t("today.freePlay")}
            variant="ghost"
            onPress={onFreePlay}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  relaxedPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  indexBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
});
