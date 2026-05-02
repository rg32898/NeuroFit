import { z } from "zod";

/**
 * Adaptive engine constants. Per FR L-8, the engine is bidirectional and
 * NEVER raises difficulty after poor performance.
 */
export const PERFORMANCE_HIGH_THRESHOLD = 70; // ≥ 70 → above 70th percentile
export const PERFORMANCE_LOW_THRESHOLD = 30; // ≤ 30 → below 30th percentile
export const SCORE_ADJUSTMENT = 250;          // 5% of 5000-point range
export const SCORE_MIN = 0;
export const SCORE_MAX = 5000;

/**
 * Workout assembler constants.
 */
export const WORKOUT_MIN_GAMES = 3;
export const WORKOUT_MAX_GAMES = 5;
export const WORKOUT_TARGET_DURATION_SEC = 12 * 60;
export const WORKOUT_HISTORY_WINDOW_DAYS = 7;

export type AdaptiveDecision = "RAISE" | "HOLD" | "LOWER";

export const workoutCompleteSchema = z
  .object({
    results: z
      .array(
        z.object({
          gameId: z.string().min(1),
          score: z.number().int().min(0).max(100),
        }),
      )
      .min(1),
  })
  .strict();

export type WorkoutCompleteBody = z.infer<typeof workoutCompleteSchema>;

export const signalTooHardSchema = z
  .object({
    gameId: z.string().min(1),
    itemId: z.string().min(1).optional(),
  })
  .strict();

export type SignalTooHardBody = z.infer<typeof signalTooHardSchema>;
