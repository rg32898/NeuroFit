import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted) ──────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  profilesTable: {},
  proficiencyScoresTable: {},
  gamesTable: {},
  gameItemsTable: {},
  progressEventsTable: {},
}));

vi.mock("../src/auth/userRepo", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  incrementTokenVersion: vi.fn(),
}));

vi.mock("../src/catalogue/catalogueRepo", () => ({
  listPublishedGames: vi.fn(),
  getPublishedGameBySlug: vi.fn(),
  getPublishedItemsForGame: vi.fn(),
  getRecentlyServedItemIds: vi.fn(),
  getProficiencyForUserDomain: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as userRepo from "../src/auth/userRepo";
import * as catalogueRepo from "../src/catalogue/catalogueRepo";

// ── Fixtures ─────────────────────────────────────────────────────────────────

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  appleSub: string | null;
  googleSub: string | null;
  tokenVersion: number;
  createdAt: Date;
  deletedAt: Date | null;
};

let users: Map<string, StoredUser>;

const MEMORY_GAME = {
  id: "g-memory",
  slug: "grid-recall",
  title: "Grid Recall",
  domain: "memory",
  description: "Memorise and reproduce a growing grid of symbols.",
  averageDurationSec: 90,
  supportsRelaxed: true,
  isFreeTier: true,
  isPublished: true,
  createdAt: new Date(),
};

const MATH_GAME = {
  id: "g-math",
  slug: "number-chain",
  title: "Number Chain",
  domain: "math",
  description: "Solve chained arithmetic operations against the clock.",
  averageDurationSec: 90,
  supportsRelaxed: true,
  isFreeTier: false,
  isPublished: true,
  createdAt: new Date(),
};

function makeItem(id: string, band: number, gameId = MEMORY_GAME.id) {
  return {
    id,
    gameId,
    payload: { puzzle: id },
    difficultyBand: band,
    version: 1,
    reviewedById: null,
    reviewedAt: null,
    isPublished: true,
    createdAt: new Date(),
  };
}

beforeEach(() => {
  users = new Map();

  vi.mocked(userRepo.findUserByEmail).mockImplementation(async (email) =>
    [...users.values()].find((u) => u.email === email) ?? null,
  );
  vi.mocked(userRepo.createUser).mockImplementation(async (data) => {
    const user: StoredUser = {
      ...data,
      appleSub: null,
      googleSub: null,
      tokenVersion: 0,
      createdAt: new Date(),
      deletedAt: null,
    };
    users.set(user.id, user);
    return user;
  });
  vi.mocked(userRepo.findUserById).mockImplementation(async (id) => {
    const user = users.get(id);
    return user ? { user, profile: null } : null;
  });

  // Catalogue defaults — tests override per-case.
  vi.mocked(catalogueRepo.listPublishedGames).mockResolvedValue([
    MEMORY_GAME,
    MATH_GAME,
  ]);
  vi.mocked(catalogueRepo.getPublishedGameBySlug).mockImplementation(
    async (slug) => {
      if (slug === MEMORY_GAME.slug) return MEMORY_GAME;
      if (slug === MATH_GAME.slug) return MATH_GAME;
      return null;
    },
  );
  vi.mocked(catalogueRepo.getPublishedItemsForGame).mockResolvedValue([]);
  vi.mocked(catalogueRepo.getRecentlyServedItemIds).mockResolvedValue(
    new Set(),
  );
  vi.mocked(catalogueRepo.getProficiencyForUserDomain).mockResolvedValue(2000);
});

async function registerUser(email = "cat@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string }; accessToken: string };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/games", () => {
  it("returns published games for an authenticated user", async () => {
    const { accessToken } = await registerUser("g1@neurofit.app");

    const res = await request(app)
      .get("/api/games")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
    expect(res.body.games.map((g: { slug: string }) => g.slug).sort()).toEqual([
      "grid-recall",
      "number-chain",
    ]);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/games");
    expect(res.status).toBe(401);
  });

  it("includes freeForUserThisWeek flag on every game", async () => {
    const { accessToken } = await registerUser("flag@neurofit.app");

    const res = await request(app)
      .get("/api/games")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    for (const game of res.body.games) {
      expect(typeof game.freeForUserThisWeek).toBe("boolean");
    }
    // Permanently-free game must always be free.
    const memory = res.body.games.find(
      (g: { slug: string }) => g.slug === "grid-recall",
    );
    expect(memory.freeForUserThisWeek).toBe(true);
  });

  it("filters by domain", async () => {
    const { accessToken } = await registerUser("dom@neurofit.app");

    vi.mocked(catalogueRepo.listPublishedGames).mockImplementationOnce(
      async (filter) => {
        expect(filter.domain).toBe("memory");
        return [MEMORY_GAME];
      },
    );

    const res = await request(app)
      .get("/api/games?domain=memory")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].domain).toBe("memory");
  });

  it("filters by isFreeTier=true", async () => {
    const { accessToken } = await registerUser("free@neurofit.app");

    vi.mocked(catalogueRepo.listPublishedGames).mockImplementationOnce(
      async (filter) => {
        expect(filter.isFreeTier).toBe(true);
        return [MEMORY_GAME];
      },
    );

    const res = await request(app)
      .get("/api/games?isFreeTier=true")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].isFreeTier).toBe(true);
  });

  it("rejects invalid domain", async () => {
    const { accessToken } = await registerUser("baddom@neurofit.app");

    const res = await request(app)
      .get("/api/games?domain=not-a-real-thing")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/games/:slug", () => {
  it("returns game detail", async () => {
    const { accessToken } = await registerUser("detail@neurofit.app");

    const res = await request(app)
      .get("/api/games/grid-recall")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.game.slug).toBe("grid-recall");
    expect(res.body.game.title).toBe("Grid Recall");
  });

  it("returns 404 for unknown slug", async () => {
    const { accessToken } = await registerUser("unknown@neurofit.app");

    const res = await request(app)
      .get("/api/games/does-not-exist")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/games/:slug/items", () => {
  it("returns items at user's band ±1, up to 10", async () => {
    const { accessToken } = await registerUser("items@neurofit.app");

    // 5 items per band (1..5), 25 total. User score 2000 → band 3.
    const items = [1, 2, 3, 4, 5].flatMap((band) =>
      [0, 1, 2, 3, 4].map((n) => makeItem(`b${band}-${n}`, band)),
    );
    vi.mocked(catalogueRepo.getPublishedItemsForGame).mockResolvedValueOnce(
      items,
    );
    vi.mocked(catalogueRepo.getProficiencyForUserDomain).mockResolvedValueOnce(
      2000,
    );

    const res = await request(app)
      .get("/api/games/grid-recall/items")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(10);
    expect(res.body.proficiencyScore).toBe(2000);
    for (const item of res.body.items) {
      expect([2, 3, 4]).toContain(item.difficultyBand);
    }
  });

  it("excludes items served in the last 30 days (de-dupe)", async () => {
    const { accessToken } = await registerUser("dedupe@neurofit.app");

    const items = [3, 3, 3, 3, 3].map((band, i) => makeItem(`x${i}`, band));
    vi.mocked(catalogueRepo.getPublishedItemsForGame).mockResolvedValue(items);
    vi.mocked(catalogueRepo.getProficiencyForUserDomain).mockResolvedValue(
      2000,
    );

    // First request — nothing recent.
    vi.mocked(catalogueRepo.getRecentlyServedItemIds).mockResolvedValueOnce(
      new Set(),
    );
    const first = await request(app)
      .get("/api/games/grid-recall/items")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(first.status).toBe(200);
    const firstIds = first.body.items.map((i: { id: string }) => i.id);
    expect(firstIds.length).toBe(5);

    // Second request — pretend the first batch was just served.
    vi.mocked(catalogueRepo.getRecentlyServedItemIds).mockResolvedValueOnce(
      new Set(firstIds),
    );
    const second = await request(app)
      .get("/api/games/grid-recall/items")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(second.status).toBe(200);
    const secondIds = second.body.items.map((i: { id: string }) => i.id);

    // Non-overlapping.
    for (const id of secondIds) {
      expect(firstIds).not.toContain(id);
    }
  });

  it("returns 404 if the game does not exist", async () => {
    const { accessToken } = await registerUser("nogame@neurofit.app");

    const res = await request(app)
      .get("/api/games/ghost-game/items")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/games/grid-recall/items");
    expect(res.status).toBe(401);
  });
});
