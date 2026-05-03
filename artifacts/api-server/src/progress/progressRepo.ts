import {
  db,
  progressEventsTable,
  workoutSessionsTable,
  type ProgressEvent,
} from "@workspace/db";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { GAME_COMPLETED_EVENT_TYPE } from "@workspace/shared/streak";

export type ProgressEventWriteInput = {
  userId: string;
  clientEventId: string;
  eventType: string;
  sessionId?: string | null;
  gameId?: string | null;
  itemId?: string | null;
  score?: number | null;
  durationMs?: number | null;
  payload?: unknown;
};

/**
 * Best-effort idempotent insert.
 *
 * The `progress_events` table has a `UNIQUE (user_id, client_event_id)`
 * constraint, so a replay of the same `clientEventId` from the same user
 * yields zero inserted rows. We use `onConflictDoNothing()` and check the
 * `RETURNING` set to know which events actually persisted.
 *
 * Returns the inserted rows; duplicates are silently dropped.
 */
export async function batchInsertProgressEvents(
  events: ProgressEventWriteInput[],
): Promise<ProgressEvent[]> {
  if (events.length === 0) return [];

  const values = events.map((e) => ({
    id: crypto.randomUUID(),
    userId: e.userId,
    sessionId: e.sessionId ?? null,
    eventType: e.eventType,
    gameId: e.gameId ?? null,
    itemId: e.itemId ?? null,
    score: e.score ?? null,
    durationMs: e.durationMs ?? null,
    payload: e.payload ?? null,
    clientEventId: e.clientEventId,
  }));

  const inserted = await db
    .insert(progressEventsTable)
    .values(values)
    .onConflictDoNothing({
      target: [
        progressEventsTable.userId,
        progressEventsTable.clientEventId,
      ],
    })
    .returning();

  return inserted;
}

/**
 * Counts game_completed events grouped by UTC calendar day, restricted to
 * the trailing `windowDays` ending on `now` (inclusive). Day keys are
 * formatted YYYY-MM-DD by Postgres so the service can map them directly
 * onto its zero-filled timeline. Days with zero events are NOT returned —
 * the caller is responsible for zero-filling.
 */
export async function getDailyCompletionCounts(
  userId: string,
  windowDays: number,
  now: Date,
): Promise<{ date: string; count: number }[]> {
  // Window starts at UTC midnight `windowDays - 1` ago so today is
  // included as the most recent bucket.
  const startUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  startUtc.setUTCDate(startUtc.getUTCDate() - (windowDays - 1));

  const dayExpr = sql<string>`to_char(${progressEventsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date: dayExpr,
      count: sql<number>`count(*)::int`,
    })
    .from(progressEventsTable)
    .where(
      and(
        eq(progressEventsTable.userId, userId),
        eq(progressEventsTable.eventType, GAME_COMPLETED_EVENT_TYPE),
        gte(progressEventsTable.createdAt, startUtc),
      ),
    )
    .groupBy(dayExpr);
  return rows;
}

/** Total game_completed events for this user, all-time. */
export async function countCompletedGames(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(progressEventsTable)
    .where(
      and(
        eq(progressEventsTable.userId, userId),
        eq(progressEventsTable.eventType, GAME_COMPLETED_EVENT_TYPE),
      ),
    );
  return row?.count ?? 0;
}

/** Total workout sessions whose `completedAt` is set. */
export async function countCompletedWorkouts(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workoutSessionsTable)
    .where(
      and(
        eq(workoutSessionsTable.userId, userId),
        isNotNull(workoutSessionsTable.completedAt),
      ),
    );
  return row?.count ?? 0;
}
