import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { domainSchema } from "@workspace/shared/profile";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getProficiencyForUserDomain,
  getPublishedGameBySlug,
  getPublishedItemsForGame,
  getRecentlyServedItemIds,
  listPublishedGames,
} from "../catalogue/catalogueRepo";
import {
  ITEMS_PER_REQUEST,
  isGameFreeForUser,
  publicGameItem,
  selectItemsForUser,
} from "../services/catalogueService";

const router = Router();

const booleanQuery = z
  .union([z.literal("true"), z.literal("false")])
  .transform((v) => v === "true");

const gamesQuerySchema = z
  .object({
    domain: domainSchema.optional(),
    isFreeTier: booleanQuery.optional(),
  })
  .strict();

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

router.get("/games", requireAuth, async (req: Request, res: Response) => {
  const parsed = gamesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    badRequest(
      res,
      parsed.error.errors[0]?.message ?? "Invalid query",
      reqId(req),
    );
    return;
  }

  const today = new Date();
  const games = await listPublishedGames({
    domain: parsed.data.domain,
    // The isFreeTier filter applies to the static flag; the rotation flag
    // (`freeForUserThisWeek`) is computed per-game below.
    isFreeTier: parsed.data.isFreeTier,
  });

  const enriched = games.map((g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    domain: g.domain,
    description: g.description,
    averageDurationSec: g.averageDurationSec,
    supportsRelaxed: g.supportsRelaxed,
    isFreeTier: g.isFreeTier,
    freeForUserThisWeek: isGameFreeForUser(req.user!.id, g, today),
  }));

  res.json({ games: enriched });
});

router.get(
  "/games/:slug",
  requireAuth,
  async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const game = await getPublishedGameBySlug(slug);
    if (!game) {
      notFound(res, "Game not found", reqId(req));
      return;
    }

    const today = new Date();
    res.json({
      game: {
        id: game.id,
        slug: game.slug,
        title: game.title,
        domain: game.domain,
        description: game.description,
        averageDurationSec: game.averageDurationSec,
        supportsRelaxed: game.supportsRelaxed,
        isFreeTier: game.isFreeTier,
        freeForUserThisWeek: isGameFreeForUser(req.user!.id, game, today),
      },
    });
  },
);

router.get(
  "/games/:slug/items",
  requireAuth,
  async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const game = await getPublishedGameBySlug(slug);
    if (!game) {
      notFound(res, "Game not found", reqId(req));
      return;
    }

    const userId = req.user!.id;
    const score = await getProficiencyForUserDomain(userId, game.domain);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [items, recent] = await Promise.all([
      getPublishedItemsForGame(game.id),
      getRecentlyServedItemIds(userId, game.id, thirtyDaysAgo),
    ]);

    const selected = selectItemsForUser(
      items,
      score,
      recent,
      ITEMS_PER_REQUEST,
    );

    res.json({
      gameId: game.id,
      slug: game.slug,
      proficiencyScore: score,
      items: selected.map(publicGameItem),
    });
  },
);

export default router;
