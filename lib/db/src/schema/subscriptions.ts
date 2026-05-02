import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subscriptionsTable = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** 'free' | 'trialing' | 'active' | 'grace' | 'canceled' | 'expired' */
  status: text("status").notNull(),
  /** 'free' | 'monthly' | 'yearly' */
  plan: text("plan").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  /** 'none' | 'apple' | 'google' | 'stripe' */
  provider: text("provider").notNull(),
  providerSubscriptionId: text("provider_subscription_id"),
  /** When the active free trial ends. Null when not in trial. */
  trialEndsAt: timestamp("trial_ends_at"),
  /** When we sent the FR-6.3 "trial ending" reminder; null = not sent. */
  trialReminderSentAt: timestamp("trial_reminder_sent_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
export type Subscription = typeof subscriptionsTable.$inferSelect;
