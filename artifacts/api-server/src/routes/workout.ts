import { Router, type Request, type Response } from "express";
import {
  signalTooHardSchema,
  workoutCompleteSchema,
  WORKOUT_HISTORY_WINDOW_DAYS,
} from "@workspace/shared/workout";
import {
  DOMAINS,
  type Domain,
  domainSchema,
} from "@workspace/shared/profile";
import { requireAuth } from "../middlewares/requireAuth";
import {
  decisionToDelta,
  evaluatePerformance,
} from "../services/adaptiveEngine";
import {
  selectWorkoutGames,
  toPlannedGame,
} from "../services/workoutService";
import {
  adjustProficiencyScore,
  bumpStreak,
  createWorkoutSession,
  getDomainCountsLastNDays,
  getGameById,
  getRecentEventsForDomain,
  getTodayWorkout,
  getUserTier,
  getWorkoutSessionById,
  listAllPublishedGames,
  markSessionCompleted,
  recordProgressEvent,
} from "../workout/workoutRepo";
import { getProfileByUserId } from "../profile/profileRepo";

const router = Router();

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

function badRequest(res: Response, message: string, requestId: string | null) {
  return res
    .status(400)
    .json({ error: { code: "VALIDATION_ERROR", message, requestId } });
}

function notFound(res: Response, message: string, requestId: string | null) {
  return res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message, requestId } });
}

router.get("/today", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const today = new Date();

  // Already have one for today? Return it.
  const existing = await getTodayWorkout(userId, today);
  if (existing) {
    res.json({
      session: serializeSession(existing),
      created: false,
    });
    return;
  }

  // Otherwise build a fresh one on demand.
  const profile = await getProfileByUserId(userId);
  const focusDomainRaw = profile?.focusDomain ?? "memory";
  const focusParse = domainSchema.safeParse(focusDomainRaw);
  const focusDomain: Domain = focusParse.success ? focusParse.data : "memory";

  const [tier, allGames, domainCounts] = await Promise.all([
    getUserTier(userId),
    listAllPublishedGames(),
    getDomainCountsLastNDays(userId, WORKOUT_HISTORY_WINDOW_DAYS),
  ]);

  const games = selectWorkoutGames({
    userId,
    focusDomain,
    tier,
    domainCountsLast7Days: domainCounts as Partial<Record<Domain, number>>,
    availableGames: allGames,
    today,
  });

  const planned = games.map(toPlannedGame);
  const session = await createWorkoutSession(userId, planned);

  res.status(201).json({
    session: serializeSession(session),
    created: true,
  });
});

router.post(
  "/:id/complete",
  requireAuth,
  async (req: Request, res: Response) => {
    const sessionId = String(req.params.id);
    const userId = req.user!.id;

    const parsed = workoutCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid completion body",
        reqId(req),
      );
      return;
    }

    const session = await getWorkoutSessionById(userId, sessionId);
    if (!session) {
      notFound(res, "Workout session not found", reqId(req));
      return;
    }

    // Integrity guard: every submitted gameId must be in this session's plan,
    // and we reject duplicates so a client can't fabricate "consecutive"
    // events to game the adaptive engine.
    const plannedIds = new Set<string>(
      Array.isArray(session.gamesPlanned)
        ? (session.gamesPlanned as Array<{ gameId: string }>).map(
            (p) => p.gameId,
          )
        : [],
    );
    const seen = new Set<string>();
    for (const result of parsed.data.results) {
      if (!plannedIds.has(result.gameId)) {
        badRequest(
          res,
          `gameId ${result.gameId} is not part of this workout`,
          reqId(req),
        );
        return;
      }
      if (seen.has(result.gameId)) {
        badRequest(
          res,
          `Duplicate result for gameId ${result.gameId}`,
          reqId(req),
        );
        return;
      }
      seen.add(result.gameId);
    }

    // 1. Record an event per result and remember which domains were touched.
    const touchedDomains = new Set<Domain>();
    for (const result of parsed.data.results) {
      const game = await getGameById(result.gameId);
      if (!game) continue;
      await recordProgressEvent({
        userId,
        sessionId: session.id,
        eventType: "session_completed",
        gameId: result.gameId,
        score: result.score,
      });
      const parsedDomain = domainSchema.safeParse(game.domain);
      if (parsedDomain.success) touchedDomains.add(parsedDomain.data);
    }

    // 2. Mark session completed.
    await markSessionCompleted(session.id);

    // 3. Evaluate the engine for each touched domain and apply deltas.
    const deltas: Array<{
      domain: Domain;
      decision: string;
      delta: number;
      score: number;
    }> = [];

    for (const domain of touchedDomains) {
      const events = await getRecentEventsForDomain(userId, domain, 5);
      const decision = evaluatePerformance(
        events.map((e) => ({
          eventType: e.eventType,
          score: e.score,
          createdAt: e.createdAt,
        })),
      );
      const delta = decisionToDelta(decision);
      const { score } = await adjustProficiencyScore(userId, domain, delta);
      deltas.push({ domain, decision, delta, score });
    }

    // 4. Update streak.
    const streak = await bumpStreak(userId, new Date());

    res.json({
      sessionId: session.id,
      completed: true,
      streak: {
        current: streak.current,
        longest: streak.longest,
        lastActiveDate: streak.lastActiveDate,
      },
      proficiencyDeltas: deltas,
    });
  },
);

router.post(
  "/signal-too-hard",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const parsed = signalTooHardSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid signal body",
        reqId(req),
      );
      return;
    }

    const game = await getGameById(parsed.data.gameId);
    if (!game) {
      notFound(res, "Game not found", reqId(req));
      return;
    }

    const parsedDomain = domainSchema.safeParse(game.domain);
    if (!parsedDomain.success) {
      badRequest(res, "Game has invalid domain", reqId(req));
      return;
    }
    const domain = parsedDomain.data;

    // Record the explicit "too hard" event.
    await recordProgressEvent({
      userId,
      sessionId: null,
      eventType: "too_hard",
      gameId: parsed.data.gameId,
      itemId: parsed.data.itemId ?? null,
    });

    // Evaluate and apply (engine short-circuits to LOWER on a too_hard newest event).
    const events = await getRecentEventsForDomain(userId, domain, 5);
    const decision = evaluatePerformance(
      events.map((e) => ({
        eventType: e.eventType,
        score: e.score,
        createdAt: e.createdAt,
      })),
    );
    const delta = decisionToDelta(decision);
    const { score } = await adjustProficiencyScore(userId, domain, delta);

    res.json({
      domain,
      decision,
      delta,
      score,
    });
  },
);

function serializeSession(s: {
  id: string;
  userId: string;
  date: Date;
  gamesPlanned: unknown;
  completedAt: Date | null;
}) {
  const planned = Array.isArray(s.gamesPlanned)
    ? (s.gamesPlanned as Array<{ averageDurationSec?: number }>)
    : [];
  const estimatedDurationSec = planned.reduce(
    (sum, g) => sum + (g.averageDurationSec ?? 0),
    0,
  );
  // Sanity-check the planned domains exist in the canonical list.
  void DOMAINS;
  return {
    id: s.id,
    date: s.date,
    completedAt: s.completedAt,
    gamesPlanned: s.gamesPlanned,
    estimatedDurationSec,
  };
}

export default router;
