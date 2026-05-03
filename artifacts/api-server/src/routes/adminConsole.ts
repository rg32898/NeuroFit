import { Router, type IRouter, type Request, type Response } from "express";
import {
  createGameSchema,
  updateGameSchema,
  createItemSchema,
  updateItemSchema,
  hotPatchItemSchema,
  itemQuerySchema,
  reportsQuerySchema,
  resolveReportSchema,
  auditQuerySchema,
} from "@workspace/shared/admin";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";
import {
  recordAudit,
  listAudit,
  listAllGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  listItems,
  getItemById,
  createItem,
  updateItemDraft,
  deleteItem,
  publishItem,
  unpublishItem,
  hotPatchItem,
  listReports,
  claimReport,
  resolveReport,
} from "../admin/adminRepo";

const router: IRouter = Router();

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

function paramId(req: Request): string {
  const v = req.params.id;
  return typeof v === "string" ? v : "";
}

function badRequest(res: Response, message: string, requestId: string | null) {
  res
    .status(400)
    .json({ error: { code: "VALIDATION_ERROR", message, requestId } });
}

function notFound(res: Response, message: string, requestId: string | null) {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message, requestId } });
}

function forbidden(res: Response, message: string, requestId: string | null) {
  res
    .status(403)
    .json({ error: { code: "FORBIDDEN", message, requestId } });
}

/* ---------- /admin/me ---------- */

router.get(
  "/me",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    res.json({ actor: req.actor });
  },
);

/* ---------- /admin/games ---------- */

router.get(
  "/games",
  requireAuth,
  requireRole("author"),
  async (_req: Request, res: Response) => {
    const games = await listAllGames();
    res.json({ games });
  },
);

router.post(
  "/games",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const parsed = createGameSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid body",
        reqId(req),
      );
      return;
    }
    if (parsed.data.isPublished === true && req.actor!.role === "author") {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "Authors cannot publish games" },
      });
      return;
    }
    const game = await createGame(parsed.data);
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "game.create",
      targetType: "game",
      targetId: game.id,
      metadata: { slug: game.slug },
    });
    res.status(201).json({ game });
  },
);

router.get(
  "/games/:id",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const game = await getGameById(paramId(req));
    if (!game) {
      notFound(res, "Game not found", reqId(req));
      return;
    }
    res.json({ game });
  },
);

router.patch(
  "/games/:id",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const parsed = updateGameSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid body",
        reqId(req),
      );
      return;
    }
    // FR-12.2 — flipping a game to published requires reviewer+
    if (parsed.data.isPublished === true && req.actor!.role === "author") {
      forbidden(
        res,
        "Publishing a game requires reviewer or admin",
        reqId(req),
      );
      return;
    }
    const game = await updateGame(paramId(req), parsed.data);
    if (!game) {
      notFound(res, "Game not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "game.update",
      targetType: "game",
      targetId: game.id,
      metadata: parsed.data,
    });
    res.json({ game });
  },
);

router.delete(
  "/games/:id",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const id = paramId(req);
    const ok = await deleteGame(id);
    if (!ok) {
      notFound(res, "Game not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "game.delete",
      targetType: "game",
      targetId: id,
    });
    res.json({ ok: true });
  },
);

/* ---------- /admin/items ---------- */

router.get(
  "/items",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const parsed = itemQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid query",
        reqId(req),
      );
      return;
    }
    const items = await listItems(parsed.data);
    res.json({ items });
  },
);

router.post(
  "/items",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid body",
        reqId(req),
      );
      return;
    }
    const item = await createItem(parsed.data);
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "item.create",
      targetType: "item",
      targetId: item.id,
      metadata: { gameId: item.gameId, difficultyBand: item.difficultyBand },
    });
    res.status(201).json({ item });
  },
);

router.get(
  "/items/:id",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const item = await getItemById(paramId(req));
    if (!item) {
      notFound(res, "Item not found", reqId(req));
      return;
    }
    res.json({ item });
  },
);

router.patch(
  "/items/:id",
  requireAuth,
  requireRole("author"),
  async (req: Request, res: Response) => {
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid body",
        reqId(req),
      );
      return;
    }
    const item = await updateItemDraft(paramId(req), parsed.data);
    if (!item) {
      res.status(409).json({
        error: {
          code: "ITEM_NOT_DRAFT",
          message:
            "Item not found or already published — use /hot-patch to update a published item.",
          requestId: reqId(req),
        },
      });
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "item.update",
      targetType: "item",
      targetId: item.id,
    });
    res.json({ item });
  },
);

router.delete(
  "/items/:id",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const id = paramId(req);
    const ok = await deleteItem(id);
    if (!ok) {
      notFound(res, "Item not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "item.delete",
      targetType: "item",
      targetId: id,
    });
    res.json({ ok: true });
  },
);

/**
 * FR-12.2 / FR-12.6 — publish a draft. Reviewer+ ONLY. AI-authored drafts
 * follow the same gate (no special path), so an unattended pipeline cannot
 * push to production.
 */
router.post(
  "/items/:id/publish",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const item = await publishItem(paramId(req), req.actor!.id);
    if (!item) {
      notFound(res, "Item not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "item.publish",
      targetType: "item",
      targetId: item.id,
      metadata: { version: item.version },
    });
    res.json({ item });
  },
);

router.post(
  "/items/:id/unpublish",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const item = await unpublishItem(paramId(req));
    if (!item) {
      notFound(res, "Item not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "item.unpublish",
      targetType: "item",
      targetId: item.id,
    });
    res.json({ item });
  },
);

/**
 * FR-12.3 — hot-patch a published item with no app-store update. Mobile
 * picks up the new payload + bumped version on next catalogue refresh.
 */
router.post(
  "/items/:id/hot-patch",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const parsed = hotPatchItemSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid body",
        reqId(req),
      );
      return;
    }
    const item = await hotPatchItem(paramId(req), req.actor!.id, parsed.data);
    if (!item) {
      notFound(res, "Item not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "item.hot_patch",
      targetType: "item",
      targetId: item.id,
      metadata: { version: item.version, note: parsed.data.note ?? null },
    });
    res.json({ item });
  },
);

/* ---------- /admin/reports ---------- */

router.get(
  "/reports",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const parsed = reportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid query",
        reqId(req),
      );
      return;
    }
    const reports = await listReports(parsed.data);
    res.json({ reports });
  },
);

router.post(
  "/reports/:id/claim",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const report = await claimReport(paramId(req), req.actor!.id);
    if (!report) {
      notFound(res, "Report not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: "report.claim",
      targetType: "report",
      targetId: report.id,
    });
    res.json({ report });
  },
);

router.post(
  "/reports/:id/resolve",
  requireAuth,
  requireRole("reviewer"),
  async (req: Request, res: Response) => {
    const parsed = resolveReportSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid body",
        reqId(req),
      );
      return;
    }
    const report = await resolveReport(paramId(req), parsed.data);
    if (!report) {
      notFound(res, "Report not found", reqId(req));
      return;
    }
    await recordAudit({
      actorUserId: req.actor!.id,
      action: `report.${parsed.data.resolution}`,
      targetType: "report",
      targetId: report.id,
      metadata: { note: parsed.data.note ?? null },
    });
    res.json({ report });
  },
);

/* ---------- /admin/audit ---------- */

router.get(
  "/audit",
  requireAuth,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      badRequest(
        res,
        parsed.error.errors[0]?.message ?? "Invalid query",
        reqId(req),
      );
      return;
    }
    const entries = await listAudit(parsed.data);
    res.json({ entries });
  },
);

export default router;
