/**
 * NeuroFit achievement catalogue.
 *
 * This module is the SINGLE SOURCE OF TRUTH for what counts as an
 * achievement. It is intentionally pure: no I/O, no async, no DB access.
 * The backend builds an `AchievementSnapshot` from authoritative data
 * (streaks table, proficiency_scores table, progress_events table) and
 * runs every predicate against it. The mobile client just renders the
 * server's response — clients NEVER decide on their own whether an
 * achievement is unlocked, because that would let them lie.
 *
 * Adding a new achievement:
 *   1. Pick a stable, snake_case `id` — never reuse one (this is the
 *      external identifier the client may key on).
 *   2. Write a deterministic predicate over `AchievementSnapshot`.
 *   3. Add a Vitest case in api-server/test/achievements.test.ts.
 */

import { DOMAINS, type Domain } from "./profile";

/** 0..MAX_PROFICIENCY_SCORE. Set by adaptive engine + assessment. */
export const MAX_PROFICIENCY_SCORE = 5000;

/**
 * 4 plain-English proficiency labels mapped from the 0..5000 score.
 * Quartiles of MAX_PROFICIENCY_SCORE (1250 each):
 *   0..1249    → Beginner
 *   1250..2499 → Intermediate
 *   2500..3749 → Advanced
 *   3750..5000 → Expert
 *
 * We deliberately collapse the engine's 5-band internal scale (used by
 * the catalogue/adaptive engine) down to 4 user-facing labels because
 * 4 buckets surveys cleanly on a single sparkline scale.
 */
export const PROFICIENCY_BANDS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;
export type ProficiencyBand = (typeof PROFICIENCY_BANDS)[number];

export function scoreToBand(score: number): ProficiencyBand {
  if (score < 1250) return "Beginner";
  if (score < 2500) return "Intermediate";
  if (score < 3750) return "Advanced";
  return "Expert";
}

/** ── Snapshot ───────────────────────────────────────────────────────── */

/**
 * A daily-completion bucket. `date` is the UTC YYYY-MM-DD string for the
 * day; `count` is the number of game_completed events recorded that day.
 * The backend always returns 30 entries (oldest first), zero-filling
 * missing days so the client doesn't need to align timestamps itself.
 */
export type DailyCompletion = {
  date: string; // YYYY-MM-DD UTC
  count: number;
};

export type StreakSummary = {
  current: number;
  longest: number;
  freezesAvailable: number;
};

/** Aggregate inputs every predicate is allowed to inspect. */
export type AchievementSnapshot = {
  streak: StreakSummary;
  proficiency: Record<Domain, number>;
  totals: {
    workoutsCompleted: number;
    gamesCompleted: number;
  };
  dailyCompletions: DailyCompletion[];
};

/** ── Catalogue ──────────────────────────────────────────────────────── */

export type Achievement = {
  id: string;
  title: string;
  description: string;
  predicate: (snapshot: AchievementSnapshot) => boolean;
};

const allAtLeast = (
  prof: Record<Domain, number>,
  threshold: number,
): boolean => DOMAINS.every((d) => (prof[d] ?? 0) >= threshold);

export const ACHIEVEMENTS: ReadonlyArray<Achievement> = [
  {
    id: "first_workout",
    title: "First Workout",
    description: "Complete your first workout.",
    predicate: (s) => s.totals.workoutsCompleted >= 1,
  },
  {
    id: "three_workouts",
    title: "Getting Started",
    description: "Finish 3 workouts.",
    predicate: (s) => s.totals.workoutsCompleted >= 3,
  },
  {
    id: "ten_workouts",
    title: "Habit Forming",
    description: "Finish 10 workouts.",
    predicate: (s) => s.totals.workoutsCompleted >= 10,
  },
  {
    id: "hundred_games",
    title: "Century",
    description: "Complete 100 games.",
    predicate: (s) => s.totals.gamesCompleted >= 100,
  },
  {
    id: "seven_day_streak",
    title: "One Week Strong",
    description: "Reach a 7-day streak.",
    predicate: (s) => s.streak.longest >= 7,
  },
  {
    id: "thirty_day_streak",
    title: "One Month Strong",
    description: "Reach a 30-day streak.",
    predicate: (s) => s.streak.longest >= 30,
  },
  {
    id: "hundred_day_streak",
    title: "Centurion",
    description: "Reach a 100-day streak.",
    predicate: (s) => s.streak.longest >= 100,
  },
  {
    id: "vocabulary_advanced",
    title: "Word Smith",
    description: "Reach Advanced in vocabulary.",
    predicate: (s) => (s.proficiency.vocabulary ?? 0) >= 2500,
  },
  {
    id: "writing_advanced",
    title: "Pen Master",
    description: "Reach Advanced in writing.",
    predicate: (s) => (s.proficiency.writing ?? 0) >= 2500,
  },
  {
    id: "reading_advanced",
    title: "Bookworm",
    description: "Reach Advanced in reading.",
    predicate: (s) => (s.proficiency.reading ?? 0) >= 2500,
  },
  {
    id: "speaking_advanced",
    title: "Smooth Talker",
    description: "Reach Advanced in speaking.",
    predicate: (s) => (s.proficiency.speaking ?? 0) >= 2500,
  },
  {
    id: "math_advanced",
    title: "Number Cruncher",
    description: "Reach Advanced in math.",
    predicate: (s) => (s.proficiency.math ?? 0) >= 2500,
  },
  {
    id: "memory_advanced",
    title: "Total Recall",
    description: "Reach Advanced in memory.",
    predicate: (s) => (s.proficiency.memory ?? 0) >= 2500,
  },
  {
    id: "all_domains_intermediate",
    title: "Well Rounded",
    description: "Reach Intermediate in every domain.",
    predicate: (s) => allAtLeast(s.proficiency, 1250),
  },
  {
    id: "all_domains_advanced",
    title: "Polymath",
    description: "Reach Advanced in every domain.",
    predicate: (s) => allAtLeast(s.proficiency, 2500),
  },
];

/** ── Computation ────────────────────────────────────────────────────── */

export type UnlockedAchievement = {
  id: string;
  title: string;
  description: string;
};

/**
 * Run every catalogue predicate against the snapshot. Pure function — no
 * I/O. Order matches `ACHIEVEMENTS` so the client gets a stable display
 * order without sorting client-side.
 */
export function computeAchievements(
  snapshot: AchievementSnapshot,
): UnlockedAchievement[] {
  return ACHIEVEMENTS.filter((a) => a.predicate(snapshot)).map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
  }));
}
