import { db, type Streak } from "@workspace/db";
import { MAX_FREEZES } from "@workspace/shared/streak";
import {
  getStreakTx,
  listAllUserIds,
  upsertStreakTx,
} from "../streak/streakRepo";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the date at UTC midnight for the day that contains `d`.
 * All streak math is done in UTC — never trust local timezones.
 */
function utcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (utcMidnight(to).getTime() - utcMidnight(from).getTime()) / MS_PER_DAY,
  );
}

/**
 * recordCompletion — the canonical streak-advance entry point.
 *
 * State machine (all comparisons in UTC):
 *   diff = 0  → no-op (already counted today, idempotent)
 *   diff = 1  → current += 1, freezes unchanged
 *   diff ≥ 2  → if freezesAvailable > 0:   current += 1, freezesAvailable -= 1
 *                else:                      current  = 1   (streak broken)
 *   diff < 0  → no-op (backdated event — never let the client roll us back)
 *
 * Wrapped in db.transaction so concurrent completions don't last-write-wins.
 */
export async function recordCompletion(
  userId: string,
  completedAt: Date,
): Promise<Streak> {
  return db.transaction(async (tx) => {
    const today = utcMidnight(completedAt);
    const existing = await getStreakTx(tx, userId);

    if (!existing) {
      return upsertStreakTx(tx, userId, {
        current: 1,
        longest: 1,
        lastActiveDate: today,
        freezesAvailable: MAX_FREEZES,
        freezesResetAt: today,
      });
    }

    const lastActive = existing.lastActiveDate
      ? utcMidnight(existing.lastActiveDate)
      : null;

    if (lastActive) {
      const diff = daysBetween(lastActive, today);
      if (diff === 0) return existing; // idempotent
      if (diff < 0) return existing;   // backdated — ignore
    }

    let newCurrent: number;
    let newFreezes = existing.freezesAvailable;

    if (!lastActive) {
      newCurrent = 1;
    } else {
      const diff = daysBetween(lastActive, today);
      if (diff === 1) {
        newCurrent = existing.current + 1;
      } else if (existing.freezesAvailable > 0) {
        newCurrent = existing.current + 1;
        newFreezes = existing.freezesAvailable - 1;
      } else {
        newCurrent = 1;
      }
    }

    const newLongest = Math.max(existing.longest, newCurrent);

    return upsertStreakTx(tx, userId, {
      current: newCurrent,
      longest: newLongest,
      lastActiveDate: today,
      freezesAvailable: newFreezes,
      freezesResetAt: existing.freezesResetAt,
    });
  });
}

/** Manual freeze consumption for support tooling. */
export async function useFreeze(userId: string): Promise<Streak> {
  return db.transaction(async (tx) => {
    const existing = await getStreakTx(tx, userId);
    if (!existing) {
      throw new Error("No streak to freeze");
    }
    if (existing.freezesAvailable <= 0) {
      throw new Error("No freezes available");
    }
    return upsertStreakTx(tx, userId, {
      current: existing.current,
      longest: existing.longest,
      lastActiveDate: existing.lastActiveDate,
      freezesAvailable: existing.freezesAvailable - 1,
      freezesResetAt: existing.freezesResetAt,
    });
  });
}

/**
 * Top up freezes to MAX_FREEZES if the calendar month has rolled over since
 * the last reset. Idempotent within the same month — safe to call from a
 * daily cron.
 */
export async function resetFreezesIfNewMonth(
  userId: string,
  now: Date,
): Promise<Streak | null> {
  return db.transaction(async (tx) => {
    const existing = await getStreakTx(tx, userId);
    if (!existing) return null;

    const lastReset = existing.freezesResetAt;
    const sameMonth =
      lastReset !== null &&
      lastReset.getUTCFullYear() === now.getUTCFullYear() &&
      lastReset.getUTCMonth() === now.getUTCMonth();

    if (sameMonth) return existing; // already reset this month

    return upsertStreakTx(tx, userId, {
      current: existing.current,
      longest: existing.longest,
      lastActiveDate: existing.lastActiveDate,
      freezesAvailable: MAX_FREEZES,
      freezesResetAt: now,
    });
  });
}

/** Support-tool override that overwrites streak fields directly. */
export async function restoreStreak(
  userId: string,
  override: {
    current?: number;
    longest?: number;
    freezesAvailable?: number;
  },
): Promise<Streak> {
  return db.transaction(async (tx) => {
    const existing = await getStreakTx(tx, userId);
    const current = override.current ?? existing?.current ?? 0;
    const longest = override.longest ?? existing?.longest ?? current;
    const freezesAvailable =
      override.freezesAvailable ?? existing?.freezesAvailable ?? MAX_FREEZES;

    return upsertStreakTx(tx, userId, {
      current,
      longest: Math.max(longest, current),
      lastActiveDate: existing?.lastActiveDate ?? null,
      freezesAvailable,
      freezesResetAt: existing?.freezesResetAt ?? null,
    });
  });
}

/**
 * Daily cron entry point. Intended to be triggered by an external scheduler
 * (Render cron, Fly machines, GitHub Actions, cron-job.org, etc.) via
 * POST /api/admin/cron/daily.
 */
export async function runDailyCron(now: Date): Promise<{ processed: number }> {
  const userIds = await listAllUserIds();
  let processed = 0;
  for (const userId of userIds) {
    await resetFreezesIfNewMonth(userId, now);
    processed += 1;
  }
  return { processed };
}
