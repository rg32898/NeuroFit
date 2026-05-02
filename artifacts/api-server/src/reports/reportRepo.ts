import {
  db,
  contentReportsTable,
  type ContentReport,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import type { ReportCategory } from "@workspace/shared/reports";
import { REPORT_DEDUPE_WINDOW_HOURS } from "@workspace/shared/reports";

export type CreateReportInput = {
  reporterId: string;
  gameItemId: string;
  category: ReportCategory;
  message: string;
};

export type CreateOrFindResult = {
  report: ContentReport;
  idempotent: boolean;
};

/**
 * Race-safe "create-or-return-existing" path for content reports.
 *
 * Two layers of dedupe:
 *   1. Application-level pre-check (24h window). Cheap & catches the common
 *      case of a user double-tapping the report button.
 *   2. Database partial unique index `content_reports_open_unique` on
 *      (reporter_id, game_item_id) WHERE status = 'open'. Catches the race
 *      window between (1) and the INSERT — two concurrent requests cannot
 *      both succeed; the loser's INSERT throws a unique violation (PG
 *      23505) which we translate back into the winning row.
 */
export async function createOrFindOpenContentReport(
  input: CreateReportInput,
): Promise<CreateOrFindResult> {
  const existing = await findRecentReport(
    input.reporterId,
    input.gameItemId,
    REPORT_DEDUPE_WINDOW_HOURS,
  );
  if (existing) return { report: existing, idempotent: true };

  try {
    const [row] = await db
      .insert(contentReportsTable)
      .values({
        id: crypto.randomUUID(),
        reporterId: input.reporterId,
        gameItemId: input.gameItemId,
        category: input.category,
        message: input.message,
      })
      .returning();
    return { report: row!, idempotent: false };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // A concurrent request just inserted the open report we were trying to
      // create. Re-fetch and treat as idempotent.
      const winner = await findRecentReport(
        input.reporterId,
        input.gameItemId,
        REPORT_DEDUPE_WINDOW_HOURS,
      );
      if (winner) return { report: winner, idempotent: true };
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

/**
 * Most recent open report from `reporterId` against `gameItemId` within the
 * dedupe window. Used both as the cheap pre-check and as the post-conflict
 * "fetch the winner" path.
 */
export async function findRecentReport(
  reporterId: string,
  gameItemId: string,
  windowHours: number,
): Promise<ContentReport | null> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [row] = await db
    .select()
    .from(contentReportsTable)
    .where(
      and(
        eq(contentReportsTable.reporterId, reporterId),
        eq(contentReportsTable.gameItemId, gameItemId),
        gte(contentReportsTable.createdAt, since),
      ),
    )
    .orderBy(desc(contentReportsTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listReportsByReporter(
  reporterId: string,
  limit = 50,
): Promise<ContentReport[]> {
  return db
    .select()
    .from(contentReportsTable)
    .where(eq(contentReportsTable.reporterId, reporterId))
    .orderBy(desc(contentReportsTable.createdAt))
    .limit(limit);
}
