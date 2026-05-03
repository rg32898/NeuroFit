import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";

import { WorkoutCompleteScreen } from "@app/screens/workout/WorkoutCompleteScreen";
import type { WorkoutCompleteResponse } from "@app/lib/workout-api";
import { Screen, Text } from "@app/components/ui";

export default function WorkoutCompleteRoute() {
  const params = useLocalSearchParams<{ payload?: string | string[] }>();

  const payload = useMemo<WorkoutCompleteResponse | null>(() => {
    const raw = Array.isArray(params.payload)
      ? params.payload[0]
      : params.payload;
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw)) as WorkoutCompleteResponse;
    } catch {
      return null;
    }
  }, [params.payload]);

  if (!payload) {
    return (
      <Screen>
        <Text variant="titleMd">Workout completed</Text>
      </Screen>
    );
  }

  return (
    <WorkoutCompleteScreen
      streak={payload.streak}
      proficiencyDeltas={payload.proficiencyDeltas}
      onDone={() => router.replace("/(tabs)")}
    />
  );
}
