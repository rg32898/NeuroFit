import { Stack } from "expo-router";
import React from "react";

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
        // Disable the swipe-back gesture during a workout so the user
        // doesn't accidentally drop their session mid-game. They can still
        // explicitly skip, or leave via the system back button.
        gestureEnabled: false,
      }}
    />
  );
}
