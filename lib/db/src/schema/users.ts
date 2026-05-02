import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  appleSub: text("apple_sub").unique(),
  googleSub: text("google_sub").unique(),
  tokenVersion: integer("token_version").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
