import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { gameItemsTable } from "./games";

/**
 * Abuse / accuracy reports against game items.
 *
 * The partial unique index `content_reports_open_unique` is the
 * race-proof half of our idempotency contract: at most ONE open report can
 * exist per (reporter, gameItem) at a time. Once moderation closes the
 * report (status → resolved / dismissed), the same user can file again.
 *
 * Combined with the 24-hour application-level dedupe window, the effective
 * behaviour is "1 open report per item per reporter, ever — until moderated".
 */
export const contentReportsTable = pgTable(
  "content_reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => usersTable.id),
    gameItemId: text("game_item_id").references(() => gameItemsTable.id),
    category: text("category").notNull(),
    message: text("message").notNull(),
    status: text("status").default("open").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    openUnique: uniqueIndex("content_reports_open_unique")
      .on(t.reporterId, t.gameItemId)
      .where(sql`${t.status} = 'open'`),
  }),
);

export type InsertContentReport = typeof contentReportsTable.$inferInsert;
export type ContentReport = typeof contentReportsTable.$inferSelect;
