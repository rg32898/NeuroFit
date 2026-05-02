import {
  db,
  notificationsTable,
  pushTokensTable,
  type Notification,
  type PushToken,
} from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";

export type NotificationChannel = "email" | "push" | "log";
export type NotificationStatus = "sent" | "failed" | "logged";

export type LogNotificationInput = {
  userId: string;
  kind: string;
  channel: NotificationChannel;
  template?: string | null;
  recipient?: string | null;
  status: NotificationStatus;
  error?: string | null;
  payload?: unknown;
};

/**
 * Append-only write to the send log. Every email/push send (success, failure,
 * or dev-mode no-op) calls this so we have a single forensic trail for
 * "I never got my X" support tickets. Never throws — log writes must not
 * block the actual transport's reply to the caller.
 */
export async function logNotification(
  input: LogNotificationInput,
): Promise<Notification> {
  const [row] = await db
    .insert(notificationsTable)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      kind: input.kind,
      channel: input.channel,
      template: input.template ?? null,
      recipient: input.recipient ?? null,
      status: input.status,
      payload: input.payload ?? null,
      error: input.error ?? null,
      sentAt:
        input.status === "sent" || input.status === "logged" ? new Date() : null,
    })
    .returning();
  return row!;
}

export async function findPushTokensForUser(
  userId: string,
): Promise<PushToken[]> {
  return db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId))
    .orderBy(desc(pushTokensTable.updatedAt));
}

/**
 * Mark the listed tokens as just-used. Best-effort — we never want a stats
 * write to break the actual push delivery.
 */
export async function touchPushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db
    .update(pushTokensTable)
    .set({ lastUsedAt: new Date() })
    .where(inArray(pushTokensTable.token, tokens));
}

/**
 * Prune tokens Expo flagged as DeviceNotRegistered (uninstalled app, token
 * rotated by OS, etc.). Called from sendPush on a per-receipt basis so we
 * don't keep hammering dead endpoints.
 */
export async function deletePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db
    .delete(pushTokensTable)
    .where(inArray(pushTokensTable.token, tokens));
}
