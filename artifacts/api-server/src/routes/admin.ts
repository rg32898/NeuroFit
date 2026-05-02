import { Router, type Request, type Response } from "express";
import { cronDailyBodySchema } from "@workspace/shared/streak";
import { config } from "../config";
import { runDailyCron } from "../services/streakService";

const router = Router();

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

/**
 * POST /admin/cron/daily
 *
 * Designed to be invoked by ANY external scheduler — Render cron, Fly
 * machines, GitHub Actions, cron-job.org, plain crontab, etc. Auth is a
 * shared CRON_SECRET sent in the `x-cron-secret` header so we don't depend
 * on Replit's scheduler.
 *
 * Idempotent: each per-user freeze reset is a no-op once it has run for the
 * current calendar month.
 */
router.post("/cron/daily", async (req: Request, res: Response) => {
  const provided = req.headers["x-cron-secret"];
  if (
    typeof provided !== "string" ||
    provided.length === 0 ||
    provided !== config.CRON_SECRET
  ) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing cron secret",
        requestId: reqId(req),
      },
    });
    return;
  }

  const parsed = cronDailyBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid body",
        requestId: reqId(req),
      },
    });
    return;
  }

  const now = parsed.data?.now ? new Date(parsed.data.now) : new Date();
  const result = await runDailyCron(now);

  res.json({
    ok: true,
    runAt: now.toISOString(),
    processed: result.processed,
  });
});

export default router;
