import { z } from "zod";

/**
 * Streak engine constants.
 *
 * MAX_FREEZES — at most 2 streak freezes are held at any time. Topped up to
 * this value on the 1st of each month by the daily cron.
 *
 * GAME_COMPLETED_EVENT_TYPE — a ProgressEvent of this type is what triggers
 * a streak update via /progress/events. Other event types (item_served, etc.)
 * are recorded but do not advance the streak.
 */
export const MAX_FREEZES = 2;
export const GAME_COMPLETED_EVENT_TYPE = "game_completed";

/** Subset of ProgressEvent shape accepted by POST /progress/events. */
export const progressEventInputSchema = z
  .object({
    clientEventId: z.string().min(1),
    eventType: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    gameId: z.string().min(1).optional(),
    itemId: z.string().min(1).optional(),
    score: z.number().int().min(0).max(100).optional(),
    durationMs: z.number().int().min(0).optional(),
    payload: z.unknown().optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .strict();

export type ProgressEventInput = z.infer<typeof progressEventInputSchema>;

export const progressEventsBatchSchema = z
  .object({
    events: z.array(progressEventInputSchema).min(1).max(100),
  })
  .strict();

export type ProgressEventsBatch = z.infer<typeof progressEventsBatchSchema>;

export const restoreStreakSchema = z
  .object({
    userId: z.string().min(1),
    current: z.number().int().min(0).optional(),
    longest: z.number().int().min(0).optional(),
    freezesAvailable: z.number().int().min(0).max(MAX_FREEZES).optional(),
  })
  .strict();

export type RestoreStreakBody = z.infer<typeof restoreStreakSchema>;

export const cronDailyBodySchema = z
  .object({
    /** Optional override of "now" for tests / replay. ISO 8601. */
    now: z.string().datetime().optional(),
  })
  .strict()
  .optional();

export type CronDailyBody = z.infer<typeof cronDailyBodySchema>;
