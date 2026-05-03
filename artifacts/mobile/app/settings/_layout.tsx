import { Stack } from "expo-router";
import React from "react";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    >
      <Stack.Screen name="preferences" options={{ title: "Preferences" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="accessibility" options={{ title: "Accessibility" }} />
      <Stack.Screen name="delete-account" options={{ title: "Delete account" }} />
    </Stack>
  );
}
