import {
  type AdaptiveDecision,
  PERFORMANCE_HIGH_THRESHOLD,
  PERFORMANCE_LOW_THRESHOLD,
  SCORE_ADJUSTMENT,
  SCORE_MAX,
  SCORE_MIN,
} from "@workspace/shared/workout";

/**
 * Subset of fields the engine cares about from a ProgressEvent.
 * Decoupled from Drizzle so the engine stays a pure function.
 */
export type EngineEvent = {
  eventType: string;
  score: number | null;
  createdAt: Date;
};

/**
 * evaluatePerformance — pure function.
 *
 * Looks at the user's last 5 ProgressEvents in a single domain (oldest → newest)
 * and returns a decision:
 *
 *   RAISE — last two scoring events were both at or above the 70th-percentile
 *           threshold. Two GREAT sessions in a row.
 *   LOWER — either:
 *             * the most recent event is an explicit "too_hard" signal, OR
 *             * the last two scoring events were both at or below the
 *               30th-percentile threshold.
 *   HOLD  — anything else (mixed, sparse data, only one event, etc.)
 *
 * Per FR L-8 (the Elevate complaint) the engine never RAISES after a poor
 * performance — RAISE is gated on TWO consecutive high scores, never one.
 */
export function evaluatePerformance(
  events: ReadonlyArray<EngineEvent>,
): AdaptiveDecision {
  if (events.length === 0) return "HOLD";

  const sorted = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  // Explicit "too hard" signal beats everything — short-circuit to LOWER.
  const newest = sorted[sorted.length - 1]!;
  if (newest.eventType === "too_hard") return "LOWER";

  const scoring = sorted.filter(
    (e): e is EngineEvent & { score: number } =>
      typeof e.score === "number" &&
      (e.eventType === "session_completed" ||
        e.eventType === "item_completed"),
  );

  if (scoring.length < 2) return "HOLD";

  const last = scoring[scoring.length - 1]!;
  const prev = scoring[scoring.length - 2]!;

  if (
    last.score >= PERFORMANCE_HIGH_THRESHOLD &&
    prev.score >= PERFORMANCE_HIGH_THRESHOLD
  ) {
    return "RAISE";
  }

  if (
    last.score <= PERFORMANCE_LOW_THRESHOLD &&
    prev.score <= PERFORMANCE_LOW_THRESHOLD
  ) {
    return "LOWER";
  }

  return "HOLD";
}

/**
 * Convert a decision into a numeric proficiency-score delta.
 * Pure helper used by both the route layer and tests.
 */
export function decisionToDelta(decision: AdaptiveDecision): number {
  switch (decision) {
    case "RAISE":
      return SCORE_ADJUSTMENT;
    case "LOWER":
      return -SCORE_ADJUSTMENT;
    case "HOLD":
      return 0;
  }
}

/** Clamp a score into the valid [0, 5000] range. */
export function clampScore(score: number): number {
  if (score < SCORE_MIN) return SCORE_MIN;
  if (score > SCORE_MAX) return SCORE_MAX;
  return score;
}
