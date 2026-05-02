import {
  findPaymentsNeedingReceipt,
  findTrialingNeedingReminder,
  getSubscription,
  insertBillingEvent,
  markCancelAtPeriodEnd,
  markReminderSent,
} from "../billing/billingRepo";
import { findUserById } from "../auth/userRepo";
import { config } from "../config";
import { logger } from "../lib/logger";
import { sendEmail, sendPush } from "./notifications";
import type { Subscription } from "@workspace/db";

/**
 * User-initiated cancellation. We never call Apple/Google APIs from here:
 *   - In-app purchases are managed in iOS Settings / Play Store; the store
 *     is the source of truth and will eventually send us the cancellation
 *     webhook. We just record the user's intent locally so the UI can show
 *     "ends on Mar 4" immediately.
 *   - For Stripe we DO want to call the API to set cancel_at_period_end on
 *     their side, but Prompt 9 keeps the local mark only — Prompt 10 wires
 *     the Stripe API call (TODO).
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
    payload: {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: sub.currentPeriodEnd,
    },
  });

  return sub;
}

export type BillingCronResult = {
  remindersSent: number;
  receiptsQueued: number;
};

/**
 * Daily-ish billing maintenance:
 *   1. FR-6.3 — send a trial-end reminder once trial-end is within
 *      SUBSCRIPTION_REMINDER_HOURS (default 48). Idempotent via the
 *      trial_reminder_sent_at column.
 *   2. FR-6.4 — send a receipt notification for every recent
 *      payment_succeeded / receipt_validated event that doesn't have one
 *      yet. The NOT EXISTS subquery in findPaymentsNeedingReceipt makes
 *      this safe to call repeatedly.
 *
 * Email is the primary transport; we ALSO push when the user has a
 * registered Expo token (best-effort, doesn't gate the cron).
 */
export async function runBillingCron(now: Date): Promise<BillingCronResult> {
  const reminderWindowMs = config.SUBSCRIPTION_REMINDER_HOURS * 60 * 60 * 1000;

  const trialing = await findTrialingNeedingReminder(now, reminderWindowMs);
  let remindersSent = 0;
  for (const sub of trialing) {
    await sendTrialReminder(sub);
    await markReminderSent(sub.userId, now);
    logger.info(
      { userId: sub.userId, trialEndsAt: sub.trialEndsAt },
      "billing.cron.trial_reminder_sent",
    );
    remindersSent += 1;
  }

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const payments = await findPaymentsNeedingReceipt(now, FIVE_MINUTES_MS);
  let receiptsQueued = 0;
  for (const event of payments) {
    await sendReceipt(event.userId, event);
    logger.info(
      { userId: event.userId, eventId: event.id },
      "billing.cron.receipt_sent",
    );
    receiptsQueued += 1;
  }

  return { remindersSent, receiptsQueued };
}

async function sendTrialReminder(sub: Subscription) {
  const account = await findUserById(sub.userId);
  const email = account?.user.email ?? null;
  const endsOn = sub.trialEndsAt
    ? new Date(sub.trialEndsAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "soon";

  if (email) {
    await sendEmail({
      userId: sub.userId,
      to: email,
      subject: "Your NeuroFit trial ends soon",
      html: trialReminderHtml(endsOn, sub.plan),
      text: `Heads up — your NeuroFit trial ends on ${endsOn}. Cancel any time from the app's Subscription screen.`,
      kind: "trial_reminder",
      template: "trial_reminder.v1",
    });
  } else {
    // No email on file — push only. sendPush handles "no tokens" gracefully.
    await sendPush({
      userId: sub.userId,
      title: "Trial ending soon",
      body: `Your NeuroFit trial ends ${endsOn}.`,
      kind: "trial_reminder",
      template: "trial_reminder.v1",
    });
  }
}

async function sendReceipt(
  userId: string,
  event: { id: string; provider: string; status: string },
) {
  const account = await findUserById(userId);
  const email = account?.user.email ?? null;

  if (email) {
    await sendEmail({
      userId,
      to: email,
      subject: "Your NeuroFit receipt",
      html: receiptHtml(event),
      text: `Receipt — billing event ${event.id} (${event.provider}, ${event.status}).`,
      kind: "receipt",
      template: "receipt.v1",
    });
  } else {
    await sendPush({
      userId,
      title: "Payment received",
      body: "Your NeuroFit subscription is active.",
      kind: "receipt",
      template: "receipt.v1",
      data: { eventId: event.id },
    });
  }
}

function trialReminderHtml(endsOn: string, plan: string): string {
  return `
    <p>Hi! Just a heads up — your NeuroFit trial ends on <strong>${endsOn}</strong>.</p>
    <p>If you do nothing, you'll be charged for the <strong>${plan}</strong> plan and
    keep full access to all brain-training games.</p>
    <p>To cancel, open the NeuroFit app, go to Subscription, and tap "Cancel".
    You'll keep access until ${endsOn}.</p>
  `;
}

function receiptHtml(event: {
  id: string;
  provider: string;
  status: string;
}): string {
  return `
    <p>Thanks for being a NeuroFit subscriber!</p>
    <p>This is your receipt confirmation — your subscription is currently
    <strong>${event.status}</strong>.</p>
    <p style="color:#888;font-size:12px">
      Reference: ${event.id} (${event.provider})
    </p>
  `;
}

export { getSubscription };
