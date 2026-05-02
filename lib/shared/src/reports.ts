import { z } from "zod";

/**
 * Allowed content-report categories. Kept tight so the abuse queue stays
 * filterable; "other" is the catch-all for everything else.
 */
export const REPORT_CATEGORIES = [
  "inappropriate",
  "broken",
  "incorrect",
  "spam",
  "copyright",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const contentReportSchema = z
  .object({
    gameItemId: z.string().min(1),
    category: z.enum(REPORT_CATEGORIES),
    message: z.string().min(1).max(2000),
  })
  .strict();

export type ContentReportInput = z.infer<typeof contentReportSchema>;

/**
 * Window inside which a duplicate (same reporter, same gameItem) returns the
 * original report instead of creating a new one. Stops a bored user from
 * spamming the abuse queue with the same report 50 times.
 */
export const REPORT_DEDUPE_WINDOW_HOURS = 24;
