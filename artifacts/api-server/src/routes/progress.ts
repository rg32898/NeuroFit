import { Router, type Request, type Response } from "express";
import {
  GAME_COMPLETED_EVENT_TYPE,
  progressEventsBatchSchema,
  restoreStreakSchema,
} from "@workspace/shared/streak";
import { config } from "../config";
import { requireAuth } from "../middlewares/requireAuth";
import { batchInsertProgressEvents } from "../progress/progressRepo";
import { getStreak } from "../streak/streakRepo";
import {
  recordCompletion,
  restoreStreak,
} from "../services/streakService";

const router = Router();

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

function badRequest(res: Response, message: string, requestId: string | null) {
  return res
    .status(400)
    .json({ error: { code: "VALIDATION_ERROR", message, requestId } });
}

function unauthorized(res: Response, requestId: string | null) {
  return res
    .status(401)
    .json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing support token",
        requestId,
      },
    });
}

/**
 * POST /progress/events
 *
 * Batched ProgressEvent intake. Idempotent per (userId, clientEventId) via
 * the table's UNIQUE constraint. If any event is GAME_COMPLETED, fires the
 * streak engine — but only if it was actually a NEW event (replays don't
 * re-trigger the streak update).
 */
router.post("/events", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const parsed = progressEventsBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(
      res,
      parsed.error.errors[0]?.message ?? "Invalid events batch",
      reqId(req),
    );
    return;
  }

  const inserted = await batchInsertProgressEvents(
    parsed.data.events.map((e) => ({
      userId,
      clientEventId: e.clientEventId,
      eventType: e.eventType,
      sessionId: e.sessionId ?? null,
      gameId: e.gameId ?? null,
      itemId: e.itemId ?? null,
      score: e.score ?? null,
      durationMs: e.durationMs ?? null,
      payload: e.payload ?? null,
    })),
  );

  const triggeredStreak = inserted.some(
    (e) => e.eventType === GAME_COMPLETED_EVENT_TYPE,
  );

  let streak = null;
  if (triggeredStreak) {
    streak = await recordCompletion(userId, new Date());
  }

  res.status(200).json({
    accepted: inserted.length,
    deduped: parsed.data.events.length - inserted.length,
    streak: streak
      ? {
          current: streak.current,
          longest: streak.longest,
          lastActiveDate: streak.lastActiveDate,
          freezesAvailable: streak.freezesAvailable,
          freezesResetAt: streak.freezesResetAt,
        }
      : null,
  });
});

/** GET /progress/streak — current state for the authenticated user. */
router.get("/streak", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const streak = await getStreak(userId);
  res.json({
    current: streak?.current ?? 0,
    longest: streak?.longest ?? 0,
    lastActiveDate: streak?.lastActiveDate ?? null,
    freezesAvailable: streak?.freezesAvailable ?? 0,
    freezesResetAt: streak?.freezesResetAt ?? null,
  });
});

/**
 * POST /progress/restore-streak
 *
 * Support-tool endpoint. Auth is the shared SUPPORT_TOKEN env var sent in the
 * `x-support-token` header — NO user JWT required because support runs out
 * of band. The token rotates via env redeploy.
 */
router.post("/restore-streak", async (req: Request, res: Response) => {
  const provided = req.headers["x-support-token"];
  if (
    typeof provided !== "string" ||
    provided.length === 0 ||
    provided !== config.SUPPORT_TOKEN
  ) {
    unauthorized(res, reqId(req));
    return;
  }

  const parsed = restoreStreakSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(
      res,
      parsed.error.errors[0]?.message ?? "Invalid restore body",
      reqId(req),
    );
    return;
  }

  const streak = await restoreStreak(parsed.data.userId, {
    current: parsed.data.current,
    longest: parsed.data.longest,
    freezesAvailable: parsed.data.freezesAvailable,
  });

  res.json({
    streak: {
      userId: streak.userId,
      current: streak.current,
      longest: streak.longest,
      lastActiveDate: streak.lastActiveDate,
      freezesAvailable: streak.freezesAvailable,
      freezesResetAt: streak.freezesResetAt,
    },
  });
});

export default router;
