import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { PlannedGame } from "../lib/workout-api";
import { Button, Card, Text } from "./ui";
import { useTheme } from "../theme";

export type GameContainerProps = {
  game: PlannedGame;
  /** Multiplier applied to the per-item timer (1, 1.5, or 2). */
  relaxedScale: number;
  /** Called when the user finishes the game. `score` is 0–100. */
  onComplete: (score: number) => void;
};

/**
 * PLACEHOLDER container that hosts an individual game inside the workout
 * runner. The real per-game React components ship in the NEXT prompt; this
 * placeholder lets the runner be wired end-to-end today so we can validate
 * navigation, progress events, and completion flow.
 *
 * Contract for the real version:
 *   - It reads `game.slug` and renders the matching game.
 *   - It is responsible for honouring `relaxedScale` when scheduling
 *     per-item timers.
 *   - It MUST call `onComplete(score)` exactly once when the user finishes,
 *     where score ∈ [0, 100].
 *
 * The placeholder simulates a finished game with a fixed score so the
 * runner's "complete all → POST /complete" path is exercisable.
 */
export function GameContainer({
  game,
  relaxedScale,
  onComplete,
}: GameContainerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="caption" tone="muted">
          {t("runner.gamePlaceholder.domainLabel")}: {game.domain}
        </Text>
        <Text variant="titleLg">{game.title}</Text>
        <Text variant="body" tone="muted">
          {t("runner.gamePlaceholder.body")}
        </Text>
        <Text variant="caption" tone="muted">
          {t("runner.gamePlaceholder.relaxed", { scale: relaxedScale })}
        </Text>
        <Button
          label={t("runner.gamePlaceholder.simulateFinish")}
          fullWidth
          accessibilityLabel={t("runner.gamePlaceholder.simulateFinish")}
          onPress={() => onComplete(80)}
        />
      </View>
    </Card>
  );
}
