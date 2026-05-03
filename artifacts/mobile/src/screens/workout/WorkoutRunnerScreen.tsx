import React, { useCallback, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { PlannedGame, WorkoutCompleteResponse } from "../../lib/workout-api";
import { Button, Card, Screen, Text } from "../../components/ui";
import { GameContainer } from "../../components/GameContainer";
import { useTheme } from "../../theme";

export type GameResult = { gameId: string; score: number };

export type WorkoutRunnerScreenProps = {
  workoutId: string;
  games: ReadonlyArray<PlannedGame>;
  /** Index to start at — used for resume after force-quit. */
  initialIndex: number;
  /** Pre-recorded results from a previous (resumed) session. */
  initialResults: ReadonlyArray<GameResult>;
  relaxedScale: number;
  /**
   * Called for every game finished (NOT for skipped ones). The runner
   * awaits this so the parent can persist progress / queue an event
   * before we advance — failure is caught and surfaced via Alert so we
   * do not silently swallow a write error.
   */
  onGameComplete: (gameId: string, score: number) => Promise<void>;
  /**
   * Called exactly once when the workout is finished (all games either
   * completed or skipped). The parent posts to /workout/:id/complete.
   */
  onWorkoutComplete: (
    results: ReadonlyArray<GameResult>,
  ) => Promise<WorkoutCompleteResponse>;
  /** Called after onWorkoutComplete resolves successfully. */
  onAfterComplete: (response: WorkoutCompleteResponse) => void;
};

/**
 * Workout runner — walks the user through the planned games in order.
 *
 * Skip semantics (FR-3.4): "Skip this game" advances to the NEXT game
 * without aborting the workout. Skipped games simply do not contribute
 * a result.
 *
 * Completion: the runner guards against double-firing onWorkoutComplete
 * via `submitting` state, so even back-to-back finishes can't trigger
 * /workout/:id/complete twice.
 */
export function WorkoutRunnerScreen({
  workoutId,
  games,
  initialIndex,
  initialResults,
  relaxedScale,
  onGameComplete,
  onWorkoutComplete,
  onAfterComplete,
}: WorkoutRunnerScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [index, setIndex] = useState(initialIndex);
  const [results, setResults] = useState<GameResult[]>([...initialResults]);
  const [submitting, setSubmitting] = useState(false);

  // Synchronous completion guards — set BEFORE any await so concurrent
  // calls from a rapid double-tap can't both observe "not submitting yet"
  // and double-fire the network request. React state lags by a render
  // tick which is too late.
  const completeInFlight = useRef(false);
  const completed = useRef(false);
  // Per-game record guard — same race protection for the game-finish
  // callback so a double-tap on "Finish game" can't enqueue two events.
  const recordInFlight = useRef(false);

  const total = games.length;
  const currentGame = games[index];

  const finishWorkout = useCallback(
    async (finalResults: ReadonlyArray<GameResult>) => {
      if (completeInFlight.current || completed.current) return;
      completeInFlight.current = true;
      setSubmitting(true);
      try {
        const response = await onWorkoutComplete(finalResults);
        completed.current = true;
        onAfterComplete(response);
      } catch (err) {
        // Reset in-flight so the user can retry. `completed` stays false.
        completeInFlight.current = false;
        Alert.alert(
          t("runner.errorCompleteTitle"),
          err instanceof Error ? err.message : t("common.error"),
          [{ text: t("common.retry"), onPress: () => void finishWorkout(finalResults) }],
        );
      } finally {
        setSubmitting(false);
      }
    },
    [onWorkoutComplete, onAfterComplete, t],
  );

  const advanceOrFinish = useCallback(
    (nextIndex: number, currentResults: ReadonlyArray<GameResult>) => {
      if (nextIndex >= total) {
        void finishWorkout(currentResults);
        return;
      }
      setIndex(nextIndex);
    },
    [total, finishWorkout],
  );

  const handleGameComplete = useCallback(
    async (score: number) => {
      if (!currentGame) return;
      // Sync re-entry guard — prevents double-tap from recording the same
      // game twice OR firing complete twice from the same finish event.
      if (recordInFlight.current || completeInFlight.current || completed.current) return;
      recordInFlight.current = true;
      try {
        // Persist the result first (parent records the progress event +
        // local resume state). If that throws we surface it but do NOT
        // advance — the user can retry the same game.
        try {
          await onGameComplete(currentGame.gameId, score);
        } catch (err) {
          Alert.alert(
            t("runner.errorRecordTitle"),
            err instanceof Error ? err.message : t("common.error"),
          );
          return;
        }
        const nextResults: GameResult[] = [
          ...results,
          { gameId: currentGame.gameId, score },
        ];
        setResults(nextResults);
        advanceOrFinish(index + 1, nextResults);
      } finally {
        recordInFlight.current = false;
      }
    },
    [currentGame, onGameComplete, results, index, advanceOrFinish, t],
  );

  const handleSkip = useCallback(() => {
    advanceOrFinish(index + 1, results);
  }, [advanceOrFinish, index, results]);

  // We've walked past the last game while waiting for the complete request.
  if (!currentGame) {
    return (
      <Screen>
        <Card>
          <View style={{ alignItems: "center", gap: theme.spacing.md }}>
            <Text variant="titleMd">{t("runner.finishingTitle")}</Text>
            <Text variant="caption" tone="muted">
              {t("runner.finishingBody")}
            </Text>
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="caption" tone="muted">
          {t("runner.progress", { current: index + 1, total })}
        </Text>
        <Text variant="displayMd">{t("runner.title")}</Text>
      </View>

      <GameContainer
        // Mounting per-game key forces a clean container reset between games
        // so any internal state (timers, refs) cannot leak across games.
        key={`${workoutId}:${currentGame.gameId}`}
        game={currentGame}
        relaxedScale={relaxedScale}
        sessionId={workoutId}
        onComplete={(score) => void handleGameComplete(score)}
      />

      <Button
        label={t("runner.skip")}
        variant="ghost"
        fullWidth
        disabled={submitting}
        onPress={handleSkip}
        accessibilityLabel={t("runner.skip")}
      />
    </Screen>
  );
}
