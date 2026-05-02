import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Expo push tokens registered by mobile clients. One user may have multiple
 * tokens (multiple devices). Token is unique globally — Expo issues a single
 * token per (device, app) combination, so collisions across users mean the
 * device was re-registered to a new account; the latest userId wins.
 */
export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform").notNull(),
    /**
     * Updated every time we successfully send to this token. We don't expire
     * tokens by age — Expo's per-message receipt is the authoritative signal
     * (DeviceNotRegistered → delete) — but lastUsedAt is the metric ops uses
     * to spot stale tokens during incident review.
     */
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    byUser: index("push_tokens_user_idx").on(t.userId),
  }),
);

export type InsertPushToken = typeof pushTokensTable.$inferInsert;
export type PushToken = typeof pushTokensTable.$inferSelect;
