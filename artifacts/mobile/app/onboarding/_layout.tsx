import { Stack } from "expo-router";
import React from "react";

/**
 * Stack for the onboarding journey. We hide the header on every screen
 * because each onboarding screen designs its own visual hierarchy and a
 * generic title bar would look out of place.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    />
  );
}
