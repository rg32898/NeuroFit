import { Stack } from "expo-router";
import React from "react";

export default function SubscriptionLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Subscription" }} />
      <Stack.Screen name="plans" options={{ title: "Plans" }} />
    </Stack>
  );
}
