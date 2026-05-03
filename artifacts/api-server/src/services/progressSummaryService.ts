import {
  computeAchievements,
  scoreToBand,
  type AchievementSnapshot,
  type DailyCompletion,
  type UnlockedAchievement,
} from "@workspace/shared/achievements";
import { DOMAINS, type Domain } from "@workspace/shared/profile";
import { getProficiencyScores } from "../profile/profileRepo";
import { getStreak } from "../streak/streakRepo";
import {
  countCompletedGames,
  countCompletedWorkouts,
  getDailyCompletionCounts,
} from "../progress/progressRepo";

const SUMMARY_WINDOW_DAYS = 30;

export type ProgressSummary = {
  streak: {
    current: number;
    longest: number;
    freezesAvailable: number;
    lastActiveDate: string | null;
  };
  proficiency: Record<Domain, number>;
  bands: Record<Domain, string>;
  totals: {
    workoutsCompleted: number;
    gamesCompleted: number;
  };
  dailyCompletions: DailyCompletion[];
  achievements: UnlockedAchievement[];
};

/**
 * Returns the canonical YYYY-MM-DD UTC string for the day containing `d`.
 * All bucket alignment in this service is UTC — must match streakService.
 */
function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build a 30-element timeline (oldest first), zero-filling any UTC day
 * that has no recorded game_completed events. The client renders the
 * sparkline directly off this array — server owns alignment so two
 * clients in different timezones see identical bars.
 */
function fillDailyTimeline(
  rows: { date: string; count: number }[],
  now: Date,
): DailyCompletion[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.date, r.count);

  const out: DailyCompletion[] = [];
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  for (let i = SUMMARY_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = utcDateKey(d);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

/**
 * One-shot dashboard aggregator for the Progress tab.
 *
 * Composes data from four authoritative sources (streak, proficiency,
 * progress_events daily counts, workout completion count) into a single
 * payload, then runs the pure achievement catalogue to derive unlocked
 * badges. We keep the read-side denormalised here — the alternative is N
 * separate /progress/* endpoints which the client would have to stitch.
 */
export async function getProgressSummary(
  userId: string,
  now: Date = new Date(),
): Promise<ProgressSummary> {
  const [streak, scoreRows, dailyRows, workoutsCompleted, gamesCompleted] =
    await Promise.all([
      getStreak(userId),
      getProficiencyScores(userId),
      getDailyCompletionCounts(userId, SUMMARY_WINDOW_DAYS, now),
      countCompletedWorkouts(userId),
      countCompletedGames(userId),
    ]);

  const proficiency: Record<Domain, number> = {
    vocabulary: 0,
    writing: 0,
    reading: 0,
    speaking: 0,
    math: 0,
    memory: 0,
  };
  for (const row of scoreRows) {
    if ((DOMAINS as readonly string[]).includes(row.domain)) {
      proficiency[row.domain as Domain] = row.score;
    }
  }

  const bands: Record<Domain, string> = {
    vocabulary: scoreToBand(proficiency.vocabulary),
    writing: scoreToBand(proficiency.writing),
    reading: scoreToBand(proficiency.reading),
    speaking: scoreToBand(proficiency.speaking),
    math: scoreToBand(proficiency.math),
    memory: scoreToBand(proficiency.memory),
  };

  const dailyCompletions = fillDailyTimeline(dailyRows, now);

  const snapshot: AchievementSnapshot = {
    streak: {
      current: streak?.current ?? 0,
      longest: streak?.longest ?? 0,
      freezesAvailable: streak?.freezesAvailable ?? 0,
    },
    proficiency,
    totals: { workoutsCompleted, gamesCompleted },
    dailyCompletions,
  };

  return {
    streak: {
      current: streak?.current ?? 0,
      longest: streak?.longest ?? 0,
      freezesAvailable: streak?.freezesAvailable ?? 0,
      lastActiveDate: streak?.lastActiveDate
        ? streak.lastActiveDate.toISOString()
        : null,
    },
    proficiency,
    bands,
    totals: snapshot.totals,
    dailyCompletions,
    achievements: computeAchievements(snapshot),
  };
}
