import {
  db,
  gamesTable,
  proficiencyScoresTable,
  progressEventsTable,
  subscriptionsTable,
  workoutSessionsTable,
  type Game,
  type ProgressEvent,
  type WorkoutSession,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Tier, PlannedGame } from "../services/workoutService";

/** Returns the most recent workout session created today (UTC) for the user. */
export async function getTodayWorkout(
  userId: string,
  today: Date,
): Promise<WorkoutSession | null> {
  const startOfDay = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const [row] = await db
    .select()
    .from(workoutSessionsTable)
    .where(
      and(
        eq(workoutSessionsTable.userId, userId),
        gte(workoutSessionsTable.date, startOfDay),
      ),
    )
    .orderBy(desc(workoutSessionsTable.date))
    .limit(1);
  return row ?? null;
}

export async function createWorkoutSession(
  userId: string,
  gamesPlanned: PlannedGame[],
): Promise<WorkoutSession> {
  const [row] = await db
    .insert(workoutSessionsTable)
    .values({
      id: crypto.randomUUID(),
      userId,
      date: new Date(),
      gamesPlanned,
    })
    .returning();
  return row!;
}

export async function getWorkoutSessionById(
  userId: string,
  sessionId: string,
): Promise<WorkoutSession | null> {
  const [row] = await db
    .select()
    .from(workoutSessionsTable)
    .where(
      and(
        eq(workoutSessionsTable.id, sessionId),
        eq(workoutSessionsTable.userId, userId),
      ),
    );
  return row ?? null;
}

export async function markSessionCompleted(
  sessionId: string,
): Promise<void> {
  await db
    .update(workoutSessionsTable)
    .set({ completedAt: new Date() })
    .where(eq(workoutSessionsTable.id, sessionId));
}

/**
 * Returns last N progress events for a user+domain, joined with the game so
 * we can filter by domain. Newest first; engine sorts again for safety.
 */
export async function getRecentEventsForDomain(
  userId: string,
  domain: string,
  limit = 5,
): Promise<ProgressEvent[]> {
  const rows = await db
    .select({
      id: progressEventsTable.id,
      userId: progressEventsTable.userId,
      sessionId: progressEventsTable.sessionId,
      eventType: progressEventsTable.eventType,
      gameId: progressEventsTable.gameId,
      itemId: progressEventsTable.itemId,
      score: progressEventsTable.score,
      durationMs: progressEventsTable.durationMs,
      payload: progressEventsTable.payload,
      clientEventId: progressEventsTable.clientEventId,
      createdAt: progressEventsTable.createdAt,
    })
    .from(progressEventsTable)
    .innerJoin(gamesTable, eq(gamesTable.id, progressEventsTable.gameId))
    .where(
      and(
        eq(progressEventsTable.userId, userId),
        eq(gamesTable.domain, domain),
      ),
    )
    .orderBy(desc(progressEventsTable.createdAt))
    .limit(limit);
  return rows;
}

/** Returns counts of progress events per domain over the last N days. */
export async function getDomainCountsLastNDays(
  userId: string,
  days: number,
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      domain: gamesTable.domain,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(progressEventsTable)
    .innerJoin(gamesTable, eq(gamesTable.id, progressEventsTable.gameId))
    .where(
      and(
        eq(progressEventsTable.userId, userId),
        gte(progressEventsTable.createdAt, since),
      ),
    )
    .groupBy(gamesTable.domain);

  const out: Record<string, number> = {};
  for (const r of rows) out[r.domain] = Number(r.count);
  return out;
}

export async function recordProgressEvent(args: {
  userId: string;
  sessionId: string | null;
  eventType: string;
  gameId: string | null;
  itemId?: string | null;
  score?: number | null;
  durationMs?: number | null;
  payload?: unknown;
  clientEventId?: string;
}): Promise<ProgressEvent> {
  const [row] = await db
    .insert(progressEventsTable)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      sessionId: args.sessionId,
      eventType: args.eventType,
      gameId: args.gameId,
      itemId: args.itemId ?? null,
      score: args.score ?? null,
      durationMs: args.durationMs ?? null,
      payload: args.payload ?? null,
      clientEventId: args.clientEventId ?? crypto.randomUUID(),
    })
    .returning();
  return row!;
}

/**
 * Atomic +/- adjustment of the proficiency score, clamped server-side via SQL
 * so concurrent requests cannot push the score out of range.
 */
export async function adjustProficiencyScore(
  userId: string,
  domain: string,
  delta: number,
): Promise<{ score: number }> {
  // Step 1: ensure a baseline row exists (score=2000) without applying delta.
  // ON CONFLICT DO NOTHING guarantees this is a no-op if the row exists.
  await db
    .insert(proficiencyScoresTable)
    .values({
      id: crypto.randomUUID(),
      userId,
      domain,
      score: 2000,
    })
    .onConflictDoNothing();

  if (delta === 0) {
    const [existing] = await db
      .select()
      .from(proficiencyScoresTable)
      .where(
        and(
          eq(proficiencyScoresTable.userId, userId),
          eq(proficiencyScoresTable.domain, domain),
        ),
      );
    return { score: existing?.score ?? 2000 };
  }

  // Step 2: apply delta exactly once via atomic, server-side clamped UPDATE.
  const [updated] = await db
    .update(proficiencyScoresTable)
    .set({
      score: sql`GREATEST(0, LEAST(5000, ${proficiencyScoresTable.score} + ${delta}))`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(proficiencyScoresTable.userId, userId),
        eq(proficiencyScoresTable.domain, domain),
      ),
    )
    .returning();

  return { score: updated?.score ?? 2000 };
}

export async function getUserTier(userId: string): Promise<Tier> {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  if (!sub) return "free";
  if (sub.status === "active" && sub.plan !== "free") return "premium";
  return "free";
}

/** Convenience: list every published game (free-tier filtering happens later). */
export async function listAllPublishedGames(): Promise<Game[]> {
  return db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.isPublished, true));
}

export async function getGameById(gameId: string): Promise<Game | null> {
  const [row] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, gameId));
  return row ?? null;
}
