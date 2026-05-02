import {
  pgTable,
  text,
  timestamp,
  json,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Append-only audit log of every subscription state change. Required for
 * self-service refund support and FR-6.x compliance reviews.
 *
 * The (provider, providerEventId) UNIQUE constraint dedupes webhook replays
 * — Stripe / Apple / Google all retry indefinitely on non-2xx, so we MUST
 * be safe against the same event arriving twice.
 */
export const billingEventsTable = pgTable(
  "billing_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** 'apple' | 'google' | 'stripe' | 'internal' */
    provider: text("provider").notNull(),
    /** e.g. 'receipt_validated', 'subscription_canceled', 'webhook' */
    eventType: text("event_type").notNull(),
    /** Provider-side event id when present (Stripe evt_*, Apple notificationUUID). */
    providerEventId: text("provider_event_id"),
    /** Resulting subscription status after this event ('active', 'canceled', ...) */
    status: text("status").notNull(),
    /** Raw provider payload for forensic replay. NEVER store PANs/cardholder data. */
    payload: json("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.provider, t.providerEventId)],
);

export type InsertBillingEvent = typeof billingEventsTable.$inferInsert;
export type BillingEvent = typeof billingEventsTable.$inferSelect;

/**
 * Outbound notification queue. The billing cron writes rows here; an actual
 * email/push transport is wired in Prompt 10. Keeping the queue in the DB
 * means we have at-least-once delivery semantics + an audit trail for
 * "I never got my receipt" support tickets.
 */
export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** 'trial_reminder' | 'receipt' */
  kind: text("kind").notNull(),
  /** 'pending' | 'sent' | 'failed' */
  status: text("status").notNull().default("pending"),
  payload: json("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

export type InsertNotification = typeof notificationsTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
