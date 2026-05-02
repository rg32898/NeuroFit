import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";

export const gamesTable = pgTable("games", {
  id: text("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  description: text("description").notNull(),
  averageDurationSec: integer("average_duration_sec").notNull(),
  supportsRelaxed: boolean("supports_relaxed").default(true).notNull(),
  isFreeTier: boolean("is_free_tier").default(false).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameItemsTable = pgTable("game_items", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  payload: json("payload").notNull(),
  difficultyBand: integer("difficulty_band").notNull(),
  version: integer("version").default(1).notNull(),
  reviewedById: text("reviewed_by_id"),
  reviewedAt: timestamp("reviewed_at"),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertGame = typeof gamesTable.$inferInsert;
export type Game = typeof gamesTable.$inferSelect;

export type InsertGameItem = typeof gameItemsTable.$inferInsert;
export type GameItem = typeof gameItemsTable.$inferSelect;
