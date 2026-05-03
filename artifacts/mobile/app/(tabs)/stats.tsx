import React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ProgressScreen } from "@app/screens/progress/ProgressScreen";
import {
  progressSummaryKeys,
  useProgressSummary,
} from "@app/lib/progress-api";
import { useAuthStore } from "@app/lib/auth-store";

export default function StatsRoute() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const summaryQuery = useProgressSummary(!!user);

  return (
    <ProgressScreen
      summary={summaryQuery.data}
      loading={summaryQuery.isLoading}
      error={summaryQuery.error as Error | null}
      onRetry={() => {
        void queryClient.invalidateQueries({
          queryKey: progressSummaryKeys.all,
        });
      }}
    />
  );
}
