import React from "react";
import { Alert, Linking } from "react-native";
import { router } from "expo-router";

import { SubscriptionStatusScreen } from "@app/screens/subscription/SubscriptionStatusScreen";
import {
  useCancelSubscription,
  usePlans,
  useRefundEligibility,
  useRequestRefund,
  useSubscriptionStatus,
} from "@app/lib/subscription-api";

export default function SubscriptionRoute() {
  const status = useSubscriptionStatus();
  const plans = usePlans();
  const cancel = useCancelSubscription();
  const refundEligibility = useRefundEligibility();
  const requestRefund = useRequestRefund();

  const handleRefund = async () => {
    const elig = refundEligibility.data;
    if (!elig?.eligible) {
      Alert.alert(
        "Not eligible for refund",
        elig?.instructions ??
          "Refunds are available within 14 days of your last charge.",
      );
      return;
    }
    try {
      const res = await requestRefund.mutateAsync();
      Alert.alert("Refund requested", res.eligibility.instructions, [
        {
          text: res.eligibility.instructionsUrl ? "Open" : "OK",
          onPress: () => {
            if (res.eligibility.instructionsUrl) {
              void Linking.openURL(res.eligibility.instructionsUrl);
            }
          },
        },
      ]);
    } catch (err) {
      Alert.alert("Couldn't submit refund request", (err as Error).message);
    }
  };

  return (
    <SubscriptionStatusScreen
      summary={status.data ?? null}
      plans={plans.data?.plans ?? []}
      loading={status.isLoading}
      cancelling={cancel.isPending}
      onCancel={async () => {
        await cancel.mutateAsync();
      }}
      onRequestRefund={handleRefund}
      onUpgrade={() => router.push("/subscription/plans")}
    />
  );
}
