import React from "react";
import { router } from "expo-router";

import { AccountDeletionScreen } from "@app/screens/settings/AccountDeletionScreen";
import { useAuthStore } from "@app/lib/auth-store";
import {
  useDeletionStatus,
  useScheduleDeletion,
  useUndoDeletion,
} from "@app/lib/account-api";

export default function DeleteAccountRoute() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const status = useDeletionStatus();
  const schedule = useScheduleDeletion();
  const undo = useUndoDeletion();

  return (
    <AccountDeletionScreen
      email={user?.email ?? null}
      scheduledAt={status.data?.scheduledAt ?? null}
      purgeAt={status.data?.purgeAt ?? null}
      loading={status.isLoading}
      scheduling={schedule.isPending}
      undoing={undo.isPending}
      onSchedule={async () => {
        await schedule.mutateAsync();
        // Server bumped tokenVersion; force a clean local logout so the
        // user lands on the auth stack and sees the confirmation email.
        await logout();
        router.replace("/onboarding/welcome");
      }}
      onUndo={async () => {
        await undo.mutateAsync();
      }}
      onCancel={() => router.back()}
    />
  );
}
