import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const streaksTable = pgTable("streaks", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  current: integer("current").default(0).notNull(),
  longest: integer("longest").default(0).notNull(),
  lastActiveDate: timestamp("last_active_date"),
  freezesAvailable: integer("freezes_available").default(2).notNull(),
  freezesResetAt: timestamp("freezes_reset_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertStreak = typeof streaksTable.$inferInsert;
export type Streak = typeof streaksTable.$inferSelect;
