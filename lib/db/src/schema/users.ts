import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  appleSub: text("apple_sub").unique(),
  googleSub: text("google_sub").unique(),
  tokenVersion: integer("token_version").default(0).notNull(),
  /**
   * FR-12.x admin console role. One of: "user" | "author" | "reviewer" | "admin".
   * Stored as plain text so we can extend the ladder later without a migration
   * dance. requireRole() in the api-server enforces a numeric hierarchy.
   */
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  /**
   * FR-6.x trust layer — when set, the account is in the 14-day reverse
   * window. The daily cron purges (sets `deletedAt`) once the window
   * elapses; users can call POST /auth/undo-delete to clear this column
   * and keep their account.
   */
  deletionScheduledAt: timestamp("deletion_scheduled_at"),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
