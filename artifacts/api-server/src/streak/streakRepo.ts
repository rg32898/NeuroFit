import {
  db,
  streaksTable,
  usersTable,
  type Streak,
} from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Drizzle's transaction callback hands us a `PgTransaction`. It has the same
 * query API as the top-level `db` but is a structurally distinct branded type
 * (missing `$client`). We extract the exact callback-parameter type so repo
 * functions can be called from inside `db.transaction(async (tx) => ...)`.
 */
export type StreakDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StreakWriteFields = {
  current: number;
  longest: number;
  lastActiveDate: Date | null;
  freezesAvailable: number;
  freezesResetAt: Date | null;
};

export async function getStreakTx(
  tx: StreakDb,
  userId: string,
): Promise<Streak | null> {
  // FOR UPDATE locks the existing streak row for the duration of the
  // surrounding transaction so two concurrent recordCompletion calls
  // can't read-modify-write the same prior value (lost-update race).
  // For a NEW user with no row yet, the lock is a no-op — but the
  // streaks PK on user_id still serialises the inserts via
  // onConflictDoUpdate, and both racing transactions compute the same
  // initial state (current=1) so the outcome is deterministic.
  const [row] = await tx
    .select()
    .from(streaksTable)
    .where(eq(streaksTable.userId, userId))
    .for("update");
  return row ?? null;
}

export async function upsertStreakTx(
  tx: StreakDb,
  userId: string,
  fields: StreakWriteFields,
): Promise<Streak> {
  const [row] = await tx
    .insert(streaksTable)
    .values({
      userId,
      current: fields.current,
      longest: fields.longest,
      lastActiveDate: fields.lastActiveDate,
      freezesAvailable: fields.freezesAvailable,
      freezesResetAt: fields.freezesResetAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: streaksTable.userId,
      set: {
        current: fields.current,
        longest: fields.longest,
        lastActiveDate: fields.lastActiveDate,
        freezesAvailable: fields.freezesAvailable,
        freezesResetAt: fields.freezesResetAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

/** Read the current streak (no transaction) — used by GET /progress/streak. */
export async function getStreak(userId: string): Promise<Streak | null> {
  const [row] = await db
    .select()
    .from(streaksTable)
    .where(eq(streaksTable.userId, userId));
  return row ?? null;
}

/**
 * Returns every userId in the system. Used by the daily cron.
 *
 * Production note: for large user bases this should switch to keyset
 * pagination over `users.id`. Kept as a single SELECT here for clarity since
 * the cron runs out-of-band and can tolerate a slow scan.
 */
export async function listAllUserIds(): Promise<string[]> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable);
  return rows.map((r) => r.id);
}
