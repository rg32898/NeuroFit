import {
  db,
  progressEventsTable,
  type ProgressEvent,
} from "@workspace/db";

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
