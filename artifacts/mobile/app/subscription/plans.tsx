import React from "react";
import { Alert } from "react-native";
import { router } from "expo-router";

import { PlansScreen } from "@app/screens/subscription/PlansScreen";
import { usePlans } from "@app/lib/subscription-api";

export default function PlansRoute() {
  const plans = usePlans();

  return (
    <PlansScreen
      plans={plans.data?.plans ?? []}
      loading={plans.isLoading}
      error={(plans.error as Error | null) ?? null}
      onSubscribe={(plan) => {
        // Real IAP flow ships in a future prompt. For now confirm intent.
        Alert.alert(
          "Coming soon",
          `Purchase flow for ${plan.title} ships in the next prompt.`,
        );
      }}
      onContinueFree={() => router.back()}
    />
  );
}
