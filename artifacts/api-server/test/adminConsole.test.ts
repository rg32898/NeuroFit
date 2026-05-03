import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted before any imports) ──────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  gamesTable: {},
  gameItemsTable: {},
  contentReportsTable: {},
  auditLogsTable: {},
}));

vi.mock("../src/admin/adminRepo", () => ({
  recordAudit: vi.fn(),
  listAudit: vi.fn(),
  listAllGames: vi.fn(),
  getGameById: vi.fn(),
  createGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
  listItems: vi.fn(),
  getItemById: vi.fn(),
  createItem: vi.fn(),
  updateItemDraft: vi.fn(),
  deleteItem: vi.fn(),
  publishItem: vi.fn(),
  unpublishItem: vi.fn(),
  hotPatchItem: vi.fn(),
  listReports: vi.fn(),
  claimReport: vi.fn(),
  resolveReport: vi.fn(),
}));

vi.mock("../src/middlewares/requireRole", async () => {
  const { hasRole } = await import("@workspace/shared/admin");
  return {
    requireRole: (min: "user" | "author" | "reviewer" | "admin") =>
      (req: any, res: any, next: any) => {
        const role = (req.headers["x-test-role"] as string) ?? "user";
        if (!req.user?.id) {
          return res.status(401).json({
            error: { code: "UNAUTHORIZED", message: "auth required" },
          });
        }
        if (!hasRole(role, min)) {
          return res.status(403).json({
            error: { code: "FORBIDDEN", message: `requires ${min}` },
          });
        }
        req.actor = { id: req.user.id, role };
        next();
      },
  };
});

vi.mock("../src/middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers["x-test-user"] ?? "test-user" };
    next();
  },
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as adminRepo from "../src/admin/adminRepo";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("admin console — role gating (FR-12.2 / FR-12.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminRepo.recordAudit).mockResolvedValue({} as never);
    vi.mocked(adminRepo.listAllGames).mockResolvedValue([]);
    vi.mocked(adminRepo.createGame).mockImplementation(async (i) => ({
      id: "g1",
      slug: i.slug,
      title: i.title,
      domain: i.domain,
      description: i.description,
      averageDurationSec: i.averageDurationSec,
      supportsRelaxed: true,
      isFreeTier: false,
      isPublished: false,
      createdAt: new Date(),
    }));
    vi.mocked(adminRepo.publishItem).mockImplementation(async (id, rid) => ({
      id,
      gameId: "g1",
      payload: { x: 1 },
      difficultyBand: 2,
      version: 1,
      reviewedById: rid,
      reviewedAt: new Date(),
      isPublished: true,
      createdAt: new Date(),
    }));
    vi.mocked(adminRepo.hotPatchItem).mockImplementation(async (id, rid) => ({
      id,
      gameId: "g1",
      payload: { hot: true },
      difficultyBand: 2,
      version: 2,
      reviewedById: rid,
      reviewedAt: new Date(),
      isPublished: true,
      createdAt: new Date(),
    }));
  });

  it("blocks default 'user' role from /admin/games (403)", async () => {
    const res = await request(app)
      .get("/api/admin/games")
      .set("x-test-role", "user");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(adminRepo.listAllGames).not.toHaveBeenCalled();
  });

  it("allows author to list games", async () => {
    const res = await request(app)
      .get("/api/admin/games")
      .set("x-test-role", "author");
    expect(res.status).toBe(200);
    expect(adminRepo.listAllGames).toHaveBeenCalled();
  });

  it("rejects author publishing an item (FR-12.2 reviewer gate)", async () => {
    const res = await request(app)
      .post("/api/admin/items/item-1/publish")
      .set("x-test-role", "author");
    expect(res.status).toBe(403);
    expect(adminRepo.publishItem).not.toHaveBeenCalled();
  });

  it("allows reviewer to publish an item", async () => {
    const res = await request(app)
      .post("/api/admin/items/item-1/publish")
      .set("x-test-role", "reviewer")
      .set("x-test-user", "reviewer-1");
    expect(res.status).toBe(200);
    expect(res.body.item.isPublished).toBe(true);
    expect(adminRepo.publishItem).toHaveBeenCalledWith("item-1", "reviewer-1");
    expect(adminRepo.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "item.publish",
        actorUserId: "reviewer-1",
      }),
    );
  });

  it("forbids author from creating an already-published game (publish bypass)", async () => {
    vi.mocked(adminRepo.createGame).mockResolvedValue({} as never);
    const res = await request(app)
      .post("/api/admin/games")
      .set("x-test-role", "author")
      .send({
        slug: "x-game",
        title: "X",
        domain: "memory",
        description: "d",
        averageDurationSec: 60,
        isPublished: true,
      });
    expect(res.status).toBe(403);
    expect(adminRepo.createGame).not.toHaveBeenCalled();
  });

  it("forbids author from flipping a game to published via PATCH", async () => {
    vi.mocked(adminRepo.updateGame).mockResolvedValue({} as never);
    const res = await request(app)
      .patch("/api/admin/games/g1")
      .set("x-test-role", "author")
      .send({ isPublished: true });
    expect(res.status).toBe(403);
    expect(adminRepo.updateGame).not.toHaveBeenCalled();
  });

  it("hot-patches a published item as reviewer (FR-12.3)", async () => {
    const res = await request(app)
      .post("/api/admin/items/item-1/hot-patch")
      .set("x-test-role", "reviewer")
      .set("x-test-user", "rv-1")
      .send({ payload: { hot: true } });
    expect(res.status).toBe(200);
    expect(res.body.item.version).toBe(2);
    expect(adminRepo.hotPatchItem).toHaveBeenCalledWith(
      "item-1",
      "rv-1",
      expect.objectContaining({ payload: { hot: true } }),
    );
  });

  it("blocks author from hot-patch", async () => {
    const res = await request(app)
      .post("/api/admin/items/item-1/hot-patch")
      .set("x-test-role", "author")
      .send({ payload: { hot: true } });
    expect(res.status).toBe(403);
    expect(adminRepo.hotPatchItem).not.toHaveBeenCalled();
  });

  it("only admin can read /admin/audit", async () => {
    vi.mocked(adminRepo.listAudit).mockResolvedValue([]);
    const reviewerRes = await request(app)
      .get("/api/admin/audit")
      .set("x-test-role", "reviewer");
    expect(reviewerRes.status).toBe(403);
    const adminRes = await request(app)
      .get("/api/admin/audit")
      .set("x-test-role", "admin");
    expect(adminRes.status).toBe(200);
  });

  it("draft → review → publish is the only path to live", async () => {
    // 1. Author creates a draft item
    vi.mocked(adminRepo.createItem).mockResolvedValueOnce({
      id: "item-X",
      gameId: "g1",
      payload: { q: "?" },
      difficultyBand: 2,
      version: 1,
      reviewedById: null,
      reviewedAt: null,
      isPublished: false,
      createdAt: new Date(),
    });
    const draftRes = await request(app)
      .post("/api/admin/items")
      .set("x-test-role", "author")
      .send({ gameId: "g1", payload: { q: "?" }, difficultyBand: 2 });
    expect(draftRes.status).toBe(201);
    expect(draftRes.body.item.isPublished).toBe(false);

    // 2. Author cannot publish
    const authorPub = await request(app)
      .post("/api/admin/items/item-X/publish")
      .set("x-test-role", "author");
    expect(authorPub.status).toBe(403);

    // 3. Reviewer publishes
    const revPub = await request(app)
      .post("/api/admin/items/item-X/publish")
      .set("x-test-role", "reviewer");
    expect(revPub.status).toBe(200);
    expect(revPub.body.item.isPublished).toBe(true);
  });
});
