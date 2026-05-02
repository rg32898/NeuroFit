import {
  pgTable,
  text,
  timestamp,
  integer,
  json,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: timestamp("date").defaultNow().notNull(),
  gamesPlanned: json("games_planned").notNull(),
  completedAt: timestamp("completed_at"),
});

export const progressEventsTable = pgTable(
  "progress_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => workoutSessionsTable.id),
    eventType: text("event_type").notNull(),
    gameId: text("game_id"),
    itemId: text("item_id"),
    score: integer("score"),
    durationMs: integer("duration_ms"),
    payload: json("payload"),
    clientEventId: text("client_event_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.clientEventId)],
);

export type InsertWorkoutSession = typeof workoutSessionsTable.$inferInsert;
export type WorkoutSession = typeof workoutSessionsTable.$inferSelect;

export type InsertProgressEvent = typeof progressEventsTable.$inferInsert;
export type ProgressEvent = typeof progressEventsTable.$inferSelect;
