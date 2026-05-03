import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import {
  WorkoutRunnerScreen,
  type GameResult,
} from "@app/screens/workout/WorkoutRunnerScreen";
import {
  progressKeys,
  useCompleteWorkoutMutation,
  useWorkoutToday,
  workoutKeys,
} from "@app/lib/workout-api";
import { useTimerScale } from "@app/lib/timer-scale-store";
import {
  clearWorkoutProgress,
  firstPendingIndex,
  getWorkoutProgress,
  recordGameCompleted,
} from "@app/lib/workout-progress";
import { Screen, Text } from "@app/components/ui";


export default function WorkoutRunnerRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = String(params.id);
  const queryClient = useQueryClient();
  const relaxedScale = useTimerScale();

  // We re-use the today query so we get the same session payload without a
  // second network round-trip. If the user deep-linked here without ever
  // hitting Today, the query will fetch fresh.
  const workoutQuery = useWorkoutToday(true);
  const completeMutation = useCompleteWorkoutMutation();

  const [resumeState, setResumeState] = useState<{
    index: number;
    results: GameResult[];
  } | null>(null);

  const games = workoutQuery.data?.session.gamesPlanned ?? [];

  // Once the workout query has SETTLED (success OR error), resolve the
  // resume state. We can't gate on `games.length > 0` alone — a query
  // error or empty plan would leave us stuck on the spinner forever.
  useEffect(() => {
    if (workoutQuery.isLoading) return;
    let cancelled = false;
    void (async () => {
      const progress = await getWorkoutProgress(workoutId);
      if (cancelled) return;
      const ids = games.map((g) => g.gameId);
      const idx = firstPendingIndex(ids, progress.completedGameIds);
      const results: GameResult[] = progress.completedGameIds
        .filter((id) => ids.includes(id) && progress.scores[id] !== undefined)
        .map((id) => ({ gameId: id, score: progress.scores[id]! }));
      setResumeState({ index: Math.min(idx, games.length), results });
    })();
    return () => {
      cancelled = true;
    };
  }, [workoutId, games, workoutQuery.isLoading]);

  const initial = useMemo(
    () => resumeState ?? { index: 0, results: [] },
    [resumeState],
  );

  if (workoutQuery.isLoading || resumeState === null) {
    return (
      <Screen>
        <View style={{ alignItems: "center", paddingVertical: 48 }}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (workoutQuery.error || !workoutQuery.data) {
    return (
      <Screen>
        <Text variant="titleMd">Couldn't load this workout.</Text>
      </Screen>
    );
  }

  return (
    <WorkoutRunnerScreen
      workoutId={workoutId}
      games={games}
      initialIndex={initial.index}
      initialResults={initial.results}
      relaxedScale={relaxedScale}
      onGameComplete={async (gameId, score) => {
        // Persist locally so a crash before the workout is sealed still
        // preserves resume state. The GAME_COMPLETED ProgressEvent is
        // owned by GameContainer (Prompt 14 framework) — enqueueing
        // here too would double-count.
        await recordGameCompleted(workoutId, gameId, score);
      }}
      onWorkoutComplete={async (results) => {
        const response = await completeMutation.mutateAsync({
          workoutId,
          results: results.map((r) => ({ gameId: r.gameId, score: r.score })),
        });
        // Clear local resume state — the workout is now sealed server-side.
        await clearWorkoutProgress(workoutId);
        // Invalidate so the Today screen + streak badge reflect the new state.
        await queryClient.invalidateQueries({
          queryKey: workoutKeys.today(),
        });
        await queryClient.invalidateQueries({
          queryKey: progressKeys.streak(),
        });
        return response;
      }}
      onAfterComplete={(response) => {
        router.replace({
          pathname: "/workout/[id]/complete",
          params: {
            id: workoutId,
            payload: encodeURIComponent(JSON.stringify(response)),
          },
        });
      }}
    />
  );
}
