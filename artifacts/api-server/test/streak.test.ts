import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted) ──────────────────────────────────────────────────────────
//
// We mock @workspace/db so db.transaction(fn) just runs fn with a fake tx.
// We mock streakRepo + progressRepo so the test owns the in-memory state.

vi.mock("@workspace/db", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
  usersTable: {},
  profilesTable: {},
  proficiencyScoresTable: {},
  gamesTable: {},
  gameItemsTable: {},
  progressEventsTable: {},
  workoutSessionsTable: {},
  streaksTable: {},
  subscriptionsTable: {},
}));

vi.mock("../src/streak/streakRepo", () => ({
  getStreakTx: vi.fn(),
  upsertStreakTx: vi.fn(),
  getStreak: vi.fn(),
  listAllUserIds: vi.fn(),
}));

vi.mock("../src/progress/progressRepo", () => ({
  batchInsertProgressEvents: vi.fn(),
}));

vi.mock("../src/auth/userRepo", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  incrementTokenVersion: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import { config } from "../src/config";
import * as streakRepo from "../src/streak/streakRepo";
import * as progressRepo from "../src/progress/progressRepo";
import * as userRepo from "../src/auth/userRepo";
import {
  recordCompletion,
  resetFreezesIfNewMonth,
  runDailyCron,
} from "../src/services/streakService";
import type { ProgressEvent, Streak, User } from "@workspace/db";
import { GAME_COMPLETED_EVENT_TYPE } from "@workspace/shared/streak";

// ── In-memory state ──────────────────────────────────────────────────────────

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
let streaks: Map<string, Streak>;
let events: ProgressEvent[];

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

beforeEach(() => {
  users = new Map();
  streaks = new Map();
  events = [];

  // ── auth repo ──
  vi.mocked(userRepo.findUserByEmail).mockImplementation(async (email) =>
    [...users.values()].find((u) => u.email === email) ?? null,
  );
  vi.mocked(userRepo.createUser).mockImplementation(async (data) => {
    const u: StoredUser = {
      ...data,
      appleSub: null,
      googleSub: null,
      tokenVersion: 0,
      createdAt: new Date(),
      deletedAt: null,
    };
    users.set(u.id, u);
    return u;
  });
  vi.mocked(userRepo.findUserById).mockImplementation(async (id) => {
    const u = users.get(id);
    return u ? { user: u as User, profile: null } : null;
  });

  // ── streak repo ──
  vi.mocked(streakRepo.getStreakTx).mockImplementation(async (_tx, userId) =>
    streaks.get(userId) ?? null,
  );
  vi.mocked(streakRepo.getStreak).mockImplementation(
    async (userId) => streaks.get(userId) ?? null,
  );
  vi.mocked(streakRepo.upsertStreakTx).mockImplementation(
    async (_tx, userId, fields) => {
      const next: Streak = {
        userId,
        current: fields.current,
        longest: fields.longest,
        lastActiveDate: fields.lastActiveDate,
        freezesAvailable: fields.freezesAvailable,
        freezesResetAt: fields.freezesResetAt,
        updatedAt: new Date(),
      };
      streaks.set(userId, next);
      return next;
    },
  );
  vi.mocked(streakRepo.listAllUserIds).mockImplementation(async () =>
    [...users.keys()],
  );

  // ── progress repo ──
  vi.mocked(progressRepo.batchInsertProgressEvents).mockImplementation(
    async (inputs) => {
      const inserted: ProgressEvent[] = [];
      for (const i of inputs) {
        const dup = events.find(
          (e) => e.userId === i.userId && e.clientEventId === i.clientEventId,
        );
        if (dup) continue; // unique constraint behaviour
        const ev: ProgressEvent = {
          id: crypto.randomUUID(),
          userId: i.userId,
          sessionId: i.sessionId ?? null,
          eventType: i.eventType,
          gameId: i.gameId ?? null,
          itemId: i.itemId ?? null,
          score: i.score ?? null,
          durationMs: i.durationMs ?? null,
          payload: i.payload ?? null,
          clientEventId: i.clientEventId,
          createdAt: new Date(),
        };
        events.push(ev);
        inserted.push(ev);
      }
      return inserted;
    },
  );
});

async function registerUser(email = "streak@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string }; accessToken: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-level state machine tests
// ─────────────────────────────────────────────────────────────────────────────

describe("streakService.recordCompletion — state machine", () => {
  it("5 consecutive days → streak 5, longest 5", async () => {
    const userId = "u-5";
    let s: Streak | null = null;
    for (let day = 1; day <= 5; day++) {
      s = await recordCompletion(userId, utcDate(2026, 5, day));
    }
    expect(s!.current).toBe(5);
    expect(s!.longest).toBe(5);
    expect(s!.freezesAvailable).toBe(2); // never used
  });

  it("skip 1 day with 2 freezes → streak survives, freezes go to 1", async () => {
    const userId = "u-freeze";
    await recordCompletion(userId, utcDate(2026, 5, 1));
    // Skipped May 2.
    const s = await recordCompletion(userId, utcDate(2026, 5, 3));

    expect(s.current).toBe(2); // streak survived the gap
    expect(s.freezesAvailable).toBe(1); // one freeze consumed
    expect(s.longest).toBe(2);
  });

  it("skip 1 day with 0 freezes → streak resets to 1", async () => {
    const userId = "u-noFreeze";
    // Seed a streak with 0 freezes.
    streaks.set(userId, {
      userId,
      current: 7,
      longest: 7,
      lastActiveDate: utcDate(2026, 5, 1),
      freezesAvailable: 0,
      freezesResetAt: utcDate(2026, 5, 1),
      updatedAt: new Date(),
    });

    const s = await recordCompletion(userId, utcDate(2026, 5, 3));
    expect(s.current).toBe(1); // reset
    expect(s.longest).toBe(7); // longest preserved
    expect(s.freezesAvailable).toBe(0);
  });

  it("same-day duplicate completion → no double-count (idempotent)", async () => {
    const userId = "u-dup";
    const a = await recordCompletion(userId, utcDate(2026, 5, 1));
    const b = await recordCompletion(userId, utcDate(2026, 5, 1));
    expect(a.current).toBe(1);
    expect(b.current).toBe(1); // unchanged
  });

  it("multi-day gap consumes exactly ONE freeze (not one per day)", async () => {
    const userId = "u-bigGap";
    await recordCompletion(userId, utcDate(2026, 5, 1));
    // Skip 8 days, complete on May 10.
    const s = await recordCompletion(userId, utcDate(2026, 5, 10));

    expect(s.current).toBe(2);          // streak survived
    expect(s.freezesAvailable).toBe(1); // exactly ONE freeze used
  });

  it("backdated completion is ignored (no client time-traveling)", async () => {
    const userId = "u-back";
    await recordCompletion(userId, utcDate(2026, 5, 5));
    const s = await recordCompletion(userId, utcDate(2026, 5, 1));
    // last active stays at May 5; current still 1.
    expect(s.current).toBe(1);
    expect(s.lastActiveDate?.toISOString()).toBe(
      utcDate(2026, 5, 5).toISOString(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetFreezesIfNewMonth + cron
// ─────────────────────────────────────────────────────────────────────────────

describe("resetFreezesIfNewMonth", () => {
  it("tops up freezes to MAX when month changes", async () => {
    const userId = "u-month";
    streaks.set(userId, {
      userId,
      current: 3,
      longest: 3,
      lastActiveDate: utcDate(2026, 4, 30),
      freezesAvailable: 0,
      freezesResetAt: utcDate(2026, 4, 15),
      updatedAt: new Date(),
    });

    const s = await resetFreezesIfNewMonth(userId, utcDate(2026, 5, 1));
    expect(s!.freezesAvailable).toBe(2);
    expect(s!.freezesResetAt?.getUTCMonth()).toBe(4); // May = month index 4
  });

  it("treats null freezesResetAt as never-reset and tops up", async () => {
    const userId = "u-null";
    streaks.set(userId, {
      userId,
      current: 1,
      longest: 1,
      lastActiveDate: utcDate(2026, 5, 5),
      freezesAvailable: 0,
      freezesResetAt: null,
      updatedAt: new Date(),
    });

    const s = await resetFreezesIfNewMonth(userId, utcDate(2026, 5, 20));
    expect(s!.freezesAvailable).toBe(2);
    expect(s!.freezesResetAt).not.toBeNull();
  });

  it("is a no-op within the same calendar month (idempotent)", async () => {
    const userId = "u-idem";
    streaks.set(userId, {
      userId,
      current: 1,
      longest: 1,
      lastActiveDate: utcDate(2026, 5, 5),
      freezesAvailable: 1,
      freezesResetAt: utcDate(2026, 5, 1),
      updatedAt: new Date(),
    });

    const s = await resetFreezesIfNewMonth(userId, utcDate(2026, 5, 20));
    expect(s!.freezesAvailable).toBe(1); // unchanged
  });
});

describe("runDailyCron", () => {
  it("processes every user", async () => {
    users.set("u-a", {} as StoredUser);
    users.set("u-b", {} as StoredUser);
    streaks.set("u-a", {
      userId: "u-a",
      current: 1,
      longest: 1,
      lastActiveDate: utcDate(2026, 4, 30),
      freezesAvailable: 0,
      freezesResetAt: utcDate(2026, 4, 1),
      updatedAt: new Date(),
    });
    streaks.set("u-b", {
      userId: "u-b",
      current: 1,
      longest: 1,
      lastActiveDate: utcDate(2026, 4, 30),
      freezesAvailable: 0,
      freezesResetAt: utcDate(2026, 4, 1),
      updatedAt: new Date(),
    });

    const result = await runDailyCron(utcDate(2026, 5, 1));
    expect(result.processed).toBe(2);
    expect(streaks.get("u-a")!.freezesAvailable).toBe(2);
    expect(streaks.get("u-b")!.freezesAvailable).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route-level tests
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/progress/events", () => {
  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/progress/events")
      .send({ events: [{ clientEventId: "x", eventType: "item_served" }] });
    expect(res.status).toBe(401);
  });

  it("rejects empty batch", async () => {
    const { accessToken } = await registerUser("empty@neurofit.app");
    const res = await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ events: [] });
    expect(res.status).toBe(400);
  });

  it("inserts events and returns counts", async () => {
    const { accessToken } = await registerUser("ins@neurofit.app");
    const res = await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        events: [
          { clientEventId: "e1", eventType: "item_served" },
          { clientEventId: "e2", eventType: "item_served" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(2);
    expect(res.body.deduped).toBe(0);
    expect(res.body.streak).toBeNull();
  });

  it("clientEventId replay → no double-count", async () => {
    const { accessToken } = await registerUser("replay@neurofit.app");

    const first = await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ events: [{ clientEventId: "rep-1", eventType: "item_served" }] });
    expect(first.body.accepted).toBe(1);

    const second = await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ events: [{ clientEventId: "rep-1", eventType: "item_served" }] });
    expect(second.status).toBe(200);
    expect(second.body.accepted).toBe(0);
    expect(second.body.deduped).toBe(1);

    // Verify only one row landed in the in-memory store.
    expect(events.filter((e) => e.clientEventId === "rep-1")).toHaveLength(1);
  });

  it("game_completed event triggers streak update", async () => {
    const { accessToken } = await registerUser("gc@neurofit.app");
    const res = await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        events: [
          { clientEventId: "gc-1", eventType: GAME_COMPLETED_EVENT_TYPE },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.streak).not.toBeNull();
    expect(res.body.streak.current).toBe(1);
  });

  it("replayed game_completed does NOT trigger a second streak update", async () => {
    const { accessToken } = await registerUser("gcrep@neurofit.app");

    await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        events: [
          { clientEventId: "gc-r1", eventType: GAME_COMPLETED_EVENT_TYPE },
        ],
      });

    const second = await request(app)
      .post("/api/progress/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        events: [
          { clientEventId: "gc-r1", eventType: GAME_COMPLETED_EVENT_TYPE },
        ],
      });

    expect(second.body.accepted).toBe(0);
    expect(second.body.streak).toBeNull(); // engine NOT re-fired
  });
});

describe("GET /api/progress/streak", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/progress/streak");
    expect(res.status).toBe(401);
  });

  it("returns zeros when no streak exists yet", async () => {
    const { accessToken } = await registerUser("zero@neurofit.app");
    const res = await request(app)
      .get("/api/progress/streak")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.current).toBe(0);
    expect(res.body.longest).toBe(0);
    expect(res.body.freezesAvailable).toBe(0);
  });

  it("returns the current streak after a completion", async () => {
    const { accessToken, user } = await registerUser("hasstr@neurofit.app");

    streaks.set(user.id, {
      userId: user.id,
      current: 4,
      longest: 7,
      lastActiveDate: utcDate(2026, 5, 1),
      freezesAvailable: 2,
      freezesResetAt: utcDate(2026, 5, 1),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/progress/streak")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.body.current).toBe(4);
    expect(res.body.longest).toBe(7);
    expect(res.body.freezesAvailable).toBe(2);
  });
});

describe("POST /api/progress/restore-streak", () => {
  it("rejects without support token", async () => {
    const res = await request(app)
      .post("/api/progress/restore-streak")
      .send({ userId: "u-x", current: 5 });
    expect(res.status).toBe(401);
  });

  it("rejects with wrong support token", async () => {
    const res = await request(app)
      .post("/api/progress/restore-streak")
      .set("x-support-token", "WRONG")
      .send({ userId: "u-x", current: 5 });
    expect(res.status).toBe(401);
  });

  it("restores a user's streak with the right token", async () => {
    const res = await request(app)
      .post("/api/progress/restore-streak")
      .set("x-support-token", config.SUPPORT_TOKEN)
      .send({ userId: "u-restore", current: 12, freezesAvailable: 2 });

    expect(res.status).toBe(200);
    expect(res.body.streak.current).toBe(12);
    expect(res.body.streak.longest).toBe(12);
    expect(res.body.streak.freezesAvailable).toBe(2);
  });
});

describe("POST /api/admin/cron/daily", () => {
  it("rejects without cron secret", async () => {
    const res = await request(app).post("/api/admin/cron/daily").send({});
    expect(res.status).toBe(401);
  });

  it("rejects with wrong cron secret", async () => {
    const res = await request(app)
      .post("/api/admin/cron/daily")
      .set("x-cron-secret", "WRONG")
      .send({});
    expect(res.status).toBe(401);
  });

  it("runs the daily cron with the right secret", async () => {
    users.set("cron-a", {} as StoredUser);
    streaks.set("cron-a", {
      userId: "cron-a",
      current: 1,
      longest: 1,
      lastActiveDate: utcDate(2026, 4, 30),
      freezesAvailable: 0,
      freezesResetAt: utcDate(2026, 4, 1),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/admin/cron/daily")
      .set("x-cron-secret", config.CRON_SECRET)
      .send({ now: "2026-05-01T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.processed).toBe(1);
    expect(streaks.get("cron-a")!.freezesAvailable).toBe(2);
  });
});
