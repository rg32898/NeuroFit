import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { gameItemsTable } from "./games";

export const contentReportsTable = pgTable("content_reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => usersTable.id),
  gameItemId: text("game_item_id").references(() => gameItemsTable.id),
  category: text("category").notNull(),
  message: text("message").notNull(),
  status: text("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertContentReport = typeof contentReportsTable.$inferInsert;
export type ContentReport = typeof contentReportsTable.$inferSelect;
