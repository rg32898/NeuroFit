import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subscriptionsTable = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  plan: text("plan").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  provider: text("provider").notNull(),
  providerSubscriptionId: text("provider_subscription_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
export type Subscription = typeof subscriptionsTable.$inferSelect;
