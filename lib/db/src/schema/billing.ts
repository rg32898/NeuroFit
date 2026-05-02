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
 * Outbound notification SEND LOG. Every call to sendEmail / sendPush appends
 * a row here regardless of outcome — this is the audit trail we use to debug
 * "I never got my receipt" / "I never got my trial reminder" complaints.
 *
 * NOT a queue. The transport is invoked synchronously from the cron / route
 * handler; rows here represent attempts, not pending work.
 */
export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** Logical message kind: 'trial_reminder' | 'receipt' | 'support_ack' | ... */
  kind: text("kind").notNull(),
  /** Transport: 'email' | 'push' | 'log' (dev fallback / no transport configured). */
  channel: text("channel").notNull(),
  /** Stable template id, e.g. 'trial_reminder.v1' — useful for content audits. */
  template: text("template"),
  /** Email address or push token; null for channel='log'. */
  recipient: text("recipient"),
  /** 'sent' | 'failed' | 'logged' */
  status: text("status").notNull(),
  payload: json("payload"),
  /** Failure message when status='failed'; never include PII or secrets here. */
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

export type InsertNotification = typeof notificationsTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
