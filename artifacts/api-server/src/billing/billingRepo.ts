import {
  db,
  billingEventsTable,
  notificationsTable,
  subscriptionsTable,
  type BillingEvent,
  type Subscription,
} from "@workspace/db";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type {
  SubscriptionPlanId,
  SubscriptionProvider,
  SubscriptionStatus,
} from "@workspace/shared/subscription";

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscription(
  userId: string,
): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  return row ?? null;
}

export type UpsertSubscriptionFields = {
  status: SubscriptionStatus;
  plan: SubscriptionPlanId;
  provider: SubscriptionProvider;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
};

export async function upsertSubscription(
  userId: string,
  fields: UpsertSubscriptionFields,
): Promise<Subscription> {
  const [row] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      ...fields,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: {
        ...fields,
        // cancelAtPeriodEnd is sticky: once the user has clicked "Cancel"
        // locally we never let a stale provider webhook flip it back to
        // false. A genuine reactivation goes through validate-receipt
        // again with status="active", and the user must then re-cancel.
        // OR semantics keep the strongest signal across both sides.
        cancelAtPeriodEnd: sql`${subscriptionsTable.cancelAtPeriodEnd} OR ${fields.cancelAtPeriodEnd}`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

/**
 * Sets cancelAtPeriodEnd=true ONLY for active/trialing subscriptions, so a
 * second cancel call is a no-op rather than a state corruption.
 *
 * NOTE: we never call the store APIs from here. For Apple/Google in-app
 * purchases the store is the source of truth — the user must cancel via
 * their device's subscription UI. We just record their intent so the UI
 * can show "ends on Mar 4" and so we know not to renew the local entitlement.
 */
export async function markCancelAtPeriodEnd(
  userId: string,
): Promise<Subscription | null> {
  const [row] = await db
    .update(subscriptionsTable)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        sql`${subscriptionsTable.status} IN ('trialing', 'active', 'grace')`,
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Subscriptions whose trial ends within `windowMs` and whose
 * trial_reminder_sent_at IS NULL. Used by /admin/cron/billing.
 */
export async function findTrialingNeedingReminder(
  now: Date,
  windowMs: number,
): Promise<Subscription[]> {
  const reminderCutoff = new Date(now.getTime() + windowMs);
  return db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.status, "trialing"),
        isNull(subscriptionsTable.trialReminderSentAt),
        gte(subscriptionsTable.trialEndsAt, now),
        lte(subscriptionsTable.trialEndsAt, reminderCutoff),
      ),
    );
}

export async function markReminderSent(
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ trialReminderSentAt: now, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));
}

// ── Billing events (audit log) ───────────────────────────────────────────────

export type BillingEventInput = {
  userId: string;
  provider: SubscriptionProvider | "internal";
  eventType: string;
  providerEventId: string | null;
  status: string;
  payload?: unknown;
};

/**
 * Insert a billing event with replay protection. Returns the row when newly
 * inserted, or null when the (provider, providerEventId) pair already
 * existed — callers use that to short-circuit duplicate webhook processing.
 */
export async function insertBillingEvent(
  input: BillingEventInput,
): Promise<BillingEvent | null> {
  const [row] = await db
    .insert(billingEventsTable)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      provider: input.provider,
      eventType: input.eventType,
      providerEventId: input.providerEventId,
      status: input.status,
      payload: input.payload ?? null,
    })
    .onConflictDoNothing({
      target: [billingEventsTable.provider, billingEventsTable.providerEventId],
    })
    .returning();
  return row ?? null;
}

// ── Notifications (lookup helpers) ───────────────────────────────────────────

/**
 * Recently-completed payment events (last `lookbackMs`) that don't yet have
 * a corresponding `receipt` notification logged for the user. FR-6.4 —
 * receipt within 5 minutes of charge. The NOT EXISTS subquery is what makes
 * this safe to call repeatedly: once a receipt has been sent (logged into
 * notifications), the same billing event is skipped.
 */
export async function findPaymentsNeedingReceipt(
  now: Date,
  lookbackMs: number,
): Promise<BillingEvent[]> {
  const since = new Date(now.getTime() - lookbackMs);
  return db
    .select()
    .from(billingEventsTable)
    .where(
      and(
        gte(billingEventsTable.createdAt, since),
        sql`${billingEventsTable.eventType} IN ('payment_succeeded', 'receipt_validated')`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${notificationsTable} n
          WHERE n.user_id = ${billingEventsTable.userId}
            AND n.kind = 'receipt'
            AND n.payload->>'eventId' = ${billingEventsTable.id}
        )`,
      ),
    );
}
