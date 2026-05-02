import { Router, type IRouter } from "express";
import { contentReportSchema } from "@workspace/shared/reports";
import { requireAuth } from "../middlewares/requireAuth";
import {
  createOrFindOpenContentReport,
  listReportsByReporter,
} from "../reports/reportRepo";

const router: IRouter = Router();

/**
 * POST /api/reports/content
 *   Submit an abuse / accuracy report against a specific game_item.
 *
 *   Idempotency: if the same reporter has filed a report against the same
 *   gameItemId in the last REPORT_DEDUPE_WINDOW_HOURS hours, we return the
 *   original (200 + idempotent: true) instead of creating a new row. This
 *   keeps the moderation queue clean without making the client track state.
 */
router.post("/content", requireAuth, async (req, res) => {
  const parsed = contentReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid report payload",
        issues: parsed.error.flatten(),
        requestId: req.id ?? null,
      },
    });
    return;
  }

  const reporterId = req.user!.id;

  const { report, idempotent } = await createOrFindOpenContentReport({
    reporterId,
    ...parsed.data,
  });

  if (!idempotent) {
    req.log?.info(
      { reportId: report.id, gameItemId: report.gameItemId, category: report.category },
      "reports.content.created",
    );
  }
  res.status(idempotent ? 200 : 201).json({ report, idempotent });
});

/**
 * GET /api/reports/mine
 *   Reports the authenticated user has filed. Useful for the "I reported this"
 *   indicator in the mobile UI and for "what did I report?" support requests.
 */
router.get("/mine", requireAuth, async (req, res) => {
  const reports = await listReportsByReporter(req.user!.id);
  res.json({ reports });
});

export default router;
