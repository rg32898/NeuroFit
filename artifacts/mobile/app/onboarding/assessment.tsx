import { router } from "expo-router";
import React from "react";

import { AssessmentScreen } from "@app/screens/onboarding/AssessmentScreen";
import { api } from "@app/lib/api";
import { useAuthStore } from "@app/lib/auth-store";
import { appendPendingEvent } from "@app/lib/guest";

const ASSESSMENT_PATH = "/api/profile/assessment";

export default function AssessmentRoute() {
  const user = useAuthStore((s) => s.user);
  const markOnboarded = useAuthStore((s) => s.markOnboarded);

  return (
    <AssessmentScreen
      onSkip={async () => {
        await markOnboarded();
        router.replace("/(tabs)");
      }}
      onSubmit={async (answers) => {
        if (user) {
          // Authenticated path — POST directly. Errors propagate so the
          // screen can show them; success falls through to navigation.
          await api.post(ASSESSMENT_PATH, { answers });
        } else {
          // Guest path — queue for replay after sign-up. The queue is
          // generic so the same mechanism handles future event types.
          await appendPendingEvent({
            method: "POST",
            path: ASSESSMENT_PATH,
            body: { answers },
          });
        }
        await markOnboarded();
        router.replace("/(tabs)");
      }}
    />
  );
}
