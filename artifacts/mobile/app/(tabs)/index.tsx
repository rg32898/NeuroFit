import { router } from "expo-router";
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { TodayScreen } from "@app/screens/today/TodayScreen";
import { RelaxedModePicker } from "@app/components/RelaxedModePicker";
import { useTimerScale } from "@app/lib/timer-scale-store";
import {
  progressKeys,
  useStreakQuery,
  useWorkoutToday,
  workoutKeys,
} from "@app/lib/workout-api";
import { useAuthStore } from "@app/lib/auth-store";

export default function TodayRoute() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const relaxedScale = useTimerScale();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Both queries are gated on having a user — for guests we still render
  // the screen shell but the workout data simply won't load. The Welcome
  // CTA flow promotes guests before reaching here in the typical path.
  const workoutQuery = useWorkoutToday(!!user);
  const streakQuery = useStreakQuery(!!user);

  return (
    <>
      <TodayScreen
        workout={workoutQuery.data}
        streak={streakQuery.data}
        loading={workoutQuery.isLoading}
        error={workoutQuery.error as Error | null}
        relaxedScale={relaxedScale}
        onStartWorkout={(id) => router.push(`/workout/${id}`)}
        onOpenRelaxedPicker={() => setPickerOpen(true)}
        onFreePlay={() => router.push("/(tabs)/train")}
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: workoutKeys.today(),
          });
          void queryClient.invalidateQueries({
            queryKey: progressKeys.streak(),
          });
        }}
      />
      <RelaxedModePicker
        visible={pickerOpen}
        current={relaxedScale}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
