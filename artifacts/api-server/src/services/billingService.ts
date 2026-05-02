import {
  createNotification,
  findPaymentsNeedingReceipt,
  findTrialingNeedingReminder,
  getSubscription,
  insertBillingEvent,
  markCancelAtPeriodEnd,
  markReminderSent,
} from "../billing/billingRepo";
import { config } from "../config";
import { logger } from "../lib/logger";
import type { Subscription } from "@workspace/db";

/**
 * User-initiated cancellation. We never call Apple/Google APIs from here:
 *   - In-app purchases are managed in iOS Settings / Play Store; the store
 *     is the source of truth and will eventually send us the cancellation
 *     webhook. We just record the user's intent locally so the UI can show
 *     "ends on Mar 4" immediately.
 *   - For Stripe we DO want to call the API to set cancel_at_period_end on
 *     their side, but Prompt 9 keeps the local mark only — Prompt 10 wires
 *     the Stripe API call.
 */
export async function cancelSubscription(
  userId: string,
): Promise<Subscription | null> {
  const sub = await markCancelAtPeriodEnd(userId);
  if (!sub) return null;

  await insertBillingEvent({
    userId,
    provider: sub.provider as "apple" | "google" | "stripe" | "none",
    eventType: "subscription_canceled",
    providerEventId: null,
    status: sub.status,
    payload: { cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd },
  });

  return sub;
}

export type BillingCronResult = {
  remindersSent: number;
  receiptsQueued: number;
};

/**
 * Daily-ish billing maintenance:
 *   1. FR-6.3 — send a reminder once trial-end is within
 *      SUBSCRIPTION_REMINDER_HOURS (default 48). Idempotent via the
 *      trial_reminder_sent_at column.
 *   2. FR-6.4 — queue a receipt notification for every recent
 *      payment_succeeded / receipt_validated event that doesn't have one
 *      yet. The transport (email/push) is wired in Prompt 10; here we
 *      just enqueue + log.
 *
 * Safe to call as often as you like — every step is idempotent.
 */
export async function runBillingCron(now: Date): Promise<BillingCronResult> {
  const reminderWindowMs = config.SUBSCRIPTION_REMINDER_HOURS * 60 * 60 * 1000;

  const trialing = await findTrialingNeedingReminder(now, reminderWindowMs);
  let remindersSent = 0;
  for (const sub of trialing) {
    await createNotification(sub.userId, "trial_reminder", {
      trialEndsAt: sub.trialEndsAt,
      plan: sub.plan,
    });
    await markReminderSent(sub.userId, now);
    logger.info(
      { userId: sub.userId, trialEndsAt: sub.trialEndsAt },
      "billing.cron.trial_reminder_queued",
    );
    remindersSent += 1;
  }

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const payments = await findPaymentsNeedingReceipt(now, FIVE_MINUTES_MS);
  let receiptsQueued = 0;
  for (const event of payments) {
    await createNotification(event.userId, "receipt", {
      eventId: event.id,
      provider: event.provider,
      status: event.status,
    });
    logger.info(
      { userId: event.userId, eventId: event.id },
      "billing.cron.receipt_queued",
    );
    receiptsQueued += 1;
  }

  return { remindersSent, receiptsQueued };
}

export { getSubscription };
