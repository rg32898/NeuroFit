import { router } from "expo-router";
import React from "react";

import { WelcomeScreen } from "@app/screens/onboarding/WelcomeScreen";
import { getOrCreateGuestId } from "@app/lib/guest";

export default function WelcomeRoute() {
  return (
    <WelcomeScreen
      onTryWorkout={async () => {
        // Reserve a guest id BEFORE moving on so any progress queued during
        // the assessment / first workout is keyed to a stable identity.
        await getOrCreateGuestId();
        router.replace("/onboarding/assessment");
      }}
      onSignIn={() => router.push("/onboarding/login")}
    />
  );
}
