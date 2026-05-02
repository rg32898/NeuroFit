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
  workoutSessionsTable: {},
  streaksTable: {},
  subscriptionsTable: {},
}));

vi.mock("../src/auth/userRepo", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  incrementTokenVersion: vi.fn(),
}));

vi.mock("../src/profile/profileRepo", () => ({
  getProfileByUserId: vi.fn(),
  upsertProfile: vi.fn(),
  getProficiencyScores: vi.fn(),
  upsertProficiencyScores: vi.fn(),
}));

vi.mock("../src/workout/workoutRepo", () => ({
  getTodayWorkout: vi.fn(),
  createWorkoutSession: vi.fn(),
  getWorkoutSessionById: vi.fn(),
  markSessionCompleted: vi.fn(),
  getRecentEventsForDomain: vi.fn(),
  getDomainCountsLastNDays: vi.fn(),
  recordProgressEvent: vi.fn(),
  adjustProficiencyScore: vi.fn(),
  getStreak: vi.fn(),
  bumpStreak: vi.fn(),
  getUserTier: vi.fn(),
  listAllPublishedGames: vi.fn(),
  getGameById: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as userRepo from "../src/auth/userRepo";
import * as profileRepo from "../src/profile/profileRepo";
import * as workoutRepo from "../src/workout/workoutRepo";
import type { Game, ProgressEvent, WorkoutSession } from "@workspace/db";

// ── Fixtures & in-memory state ───────────────────────────────────────────────

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
let events: ProgressEvent[];
let scores: Map<string, number>; // key: `${userId}:${domain}`
let sessions: Map<string, WorkoutSession>;
let todayWorkouts: Map<string, WorkoutSession>;

const GAMES: Game[] = [
  {
    id: "g-memory",
    slug: "grid-recall",
    title: "Grid Recall",
    domain: "memory",
    description: "",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
    isPublished: true,
    createdAt: new Date(),
  },
  {
    id: "g-math",
    slug: "number-chain",
    title: "Number Chain",
    domain: "math",
    description: "",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
    isPublished: true,
    createdAt: new Date(),
  },
  {
    id: "g-vocab",
    slug: "word-burst",
    title: "Word Burst",
    domain: "vocabulary",
    description: "",
    averageDurationSec: 90,
    supportsRelaxed: true,
    isFreeTier: true,
    isPublished: true,
    createdAt: new Date(),
  },
];

function gameById(id: string): Game | null {
  return GAMES.find((g) => g.id === id) ?? null;
}

beforeEach(() => {
  users = new Map();
  events = [];
  scores = new Map();
  sessions = new Map();
  todayWorkouts = new Map();

  // ── Auth repo ──
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

  // ── Profile repo ──
  vi.mocked(profileRepo.getProfileByUserId).mockImplementation(async () => ({
    userId: "x",
    displayName: null,
    birthYear: null,
    focusDomain: "memory",
    relaxedMode: true,
    timerScale: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  // ── Workout repo ──
  vi.mocked(workoutRepo.getUserTier).mockResolvedValue("premium");
  vi.mocked(workoutRepo.listAllPublishedGames).mockResolvedValue(GAMES);
  vi.mocked(workoutRepo.getDomainCountsLastNDays).mockResolvedValue({});

  vi.mocked(workoutRepo.getTodayWorkout).mockImplementation(async (userId) =>
    todayWorkouts.get(userId) ?? null,
  );
  vi.mocked(workoutRepo.createWorkoutSession).mockImplementation(
    async (userId, gamesPlanned) => {
      const session: WorkoutSession = {
        id: crypto.randomUUID(),
        userId,
        date: new Date(),
        gamesPlanned,
        completedAt: null,
      };
      sessions.set(session.id, session);
      todayWorkouts.set(userId, session);
      return session;
    },
  );
  vi.mocked(workoutRepo.getWorkoutSessionById).mockImplementation(
    async (userId, sessionId) => {
      const s = sessions.get(sessionId);
      return s && s.userId === userId ? s : null;
    },
  );
  vi.mocked(workoutRepo.markSessionCompleted).mockImplementation(
    async (sessionId) => {
      const s = sessions.get(sessionId);
      if (s) s.completedAt = new Date();
    },
  );

  vi.mocked(workoutRepo.recordProgressEvent).mockImplementation(async (args) => {
    const ev: ProgressEvent = {
      id: crypto.randomUUID(),
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      eventType: args.eventType,
      gameId: args.gameId ?? null,
      itemId: args.itemId ?? null,
      score: args.score ?? null,
      durationMs: args.durationMs ?? null,
      payload: args.payload ?? null,
      clientEventId: args.clientEventId ?? crypto.randomUUID(),
      createdAt: new Date(),
    };
    events.push(ev);
    return ev;
  });

  vi.mocked(workoutRepo.getRecentEventsForDomain).mockImplementation(
    async (userId, domain, limit = 5) => {
      const filtered = events
        .filter((e) => e.userId === userId)
        .filter((e) => {
          const game = e.gameId ? gameById(e.gameId) : null;
          return game?.domain === domain;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
      return filtered;
    },
  );

  vi.mocked(workoutRepo.adjustProficiencyScore).mockImplementation(
    async (userId, domain, delta) => {
      const key = `${userId}:${domain}`;
      const current = scores.get(key) ?? 2000;
      const next = Math.max(0, Math.min(5000, current + delta));
      scores.set(key, next);
      return { score: next };
    },
  );

  vi.mocked(workoutRepo.bumpStreak).mockImplementation(async (userId) => ({
    userId,
    current: 1,
    longest: 1,
    lastActiveDate: new Date(),
    freezesAvailable: 2,
    freezesResetAt: null,
    updatedAt: new Date(),
  }));

  vi.mocked(workoutRepo.getGameById).mockImplementation(
    async (id) => gameById(id),
  );
});

async function registerUser(email = "wo@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string }; accessToken: string };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/workout/today", () => {
  it("creates a new workout with 3-5 games on first request of the day", async () => {
    const { accessToken } = await registerUser("today@neurofit.app");

    const res = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.session.gamesPlanned.length).toBeGreaterThanOrEqual(3);
    expect(res.body.session.gamesPlanned.length).toBeLessThanOrEqual(5);
    // focus domain (memory from default profile) must appear
    expect(
      res.body.session.gamesPlanned.some(
        (g: { domain: string }) => g.domain === "memory",
      ),
    ).toBe(true);
  });

  it("returns the existing workout on subsequent requests the same day", async () => {
    const { accessToken } = await registerUser("again@neurofit.app");

    const first = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(first.status).toBe(201);
    const firstId = first.body.session.id;

    const second = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.session.id).toBe(firstId);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/workout/today");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/workout/:id/complete", () => {
  it("returns 404 for unknown session id", async () => {
    const { accessToken } = await registerUser("nope@neurofit.app");
    const res = await request(app)
      .post("/api/workout/does-not-exist/complete")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ results: [{ gameId: "g-memory", score: 80 }] });
    expect(res.status).toBe(404);
  });

  it("rejects gameId that is not part of the session plan", async () => {
    const { accessToken } = await registerUser("notplanned@neurofit.app");
    const today = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    const sessionId = today.body.session.id;

    const res = await request(app)
      .post(`/api/workout/${sessionId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ results: [{ gameId: "g-not-in-plan", score: 80 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not part of this workout/);
  });

  it("rejects duplicate gameIds in one completion", async () => {
    const { accessToken } = await registerUser("dup@neurofit.app");
    const today = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    const sessionId = today.body.session.id;

    const res = await request(app)
      .post(`/api/workout/${sessionId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        results: [
          { gameId: "g-memory", score: 90 },
          { gameId: "g-memory", score: 95 },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Duplicate/);
  });

  it("rejects empty results array", async () => {
    const { accessToken } = await registerUser("empty@neurofit.app");
    const today = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    const sessionId = today.body.session.id;

    const res = await request(app)
      .post(`/api/workout/${sessionId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ results: [] });
    expect(res.status).toBe(400);
  });

  it("returns proficiency deltas and updated streak", async () => {
    const { accessToken } = await registerUser("delta@neurofit.app");

    const today = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    const sessionId = today.body.session.id;

    const res = await request(app)
      .post(`/api/workout/${sessionId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        results: [
          { gameId: "g-memory", score: 50 },
          { gameId: "g-math", score: 50 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body.streak.current).toBeGreaterThanOrEqual(1);
    expect(res.body.proficiencyDeltas.length).toBeGreaterThanOrEqual(2);
    // single mid-range scores → HOLD → delta 0
    for (const d of res.body.proficiencyDeltas) {
      expect(d.decision).toBe("HOLD");
      expect(d.delta).toBe(0);
    }
  });
});

describe("Integration: register → 2 high sessions → score went UP", () => {
  it("two consecutive high session_completed events trigger RAISE", async () => {
    const { accessToken, user } = await registerUser("raise@neurofit.app");

    // 1st workout — score memory at 90.
    const firstToday = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    const firstId = firstToday.body.session.id;

    const firstComplete = await request(app)
      .post(`/api/workout/${firstId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ results: [{ gameId: "g-memory", score: 90 }] });
    expect(firstComplete.status).toBe(200);
    // Only one scoring event so far → HOLD
    expect(firstComplete.body.proficiencyDeltas[0].decision).toBe("HOLD");
    expect(scores.get(`${user.id}:memory`)).toBe(2000);

    // Simulate "next day" by clearing the cached today workout so a new one
    // can be created (we don't actually advance time).
    todayWorkouts.delete(user.id);

    const secondToday = await request(app)
      .get("/api/workout/today")
      .set("Authorization", `Bearer ${accessToken}`);
    const secondId = secondToday.body.session.id;

    const secondComplete = await request(app)
      .post(`/api/workout/${secondId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ results: [{ gameId: "g-memory", score: 90 }] });
    expect(secondComplete.status).toBe(200);

    // Two-in-a-row high → RAISE → score went up.
    const memoryDelta = secondComplete.body.proficiencyDeltas.find(
      (d: { domain: string }) => d.domain === "memory",
    );
    expect(memoryDelta.decision).toBe("RAISE");
    expect(memoryDelta.delta).toBeGreaterThan(0);
    expect(scores.get(`${user.id}:memory`)).toBeGreaterThan(2000);
  });
});

describe("POST /api/workout/signal-too-hard", () => {
  it("records too_hard event and lowers proficiency", async () => {
    const { accessToken, user } = await registerUser("hard@neurofit.app");

    const res = await request(app)
      .post("/api/workout/signal-too-hard")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ gameId: "g-memory" });

    expect(res.status).toBe(200);
    expect(res.body.domain).toBe("memory");
    expect(res.body.decision).toBe("LOWER");
    expect(res.body.delta).toBeLessThan(0);
    expect(scores.get(`${user.id}:memory`)).toBeLessThan(2000);
  });

  it("returns 404 for unknown game", async () => {
    const { accessToken } = await registerUser("hardnone@neurofit.app");
    const res = await request(app)
      .post("/api/workout/signal-too-hard")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ gameId: "g-ghost" });
    expect(res.status).toBe(404);
  });

  it("rejects invalid body", async () => {
    const { accessToken } = await registerUser("hardbad@neurofit.app");
    const res = await request(app)
      .post("/api/workout/signal-too-hard")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/workout/signal-too-hard")
      .send({ gameId: "g-memory" });
    expect(res.status).toBe(401);
  });
});
