import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted) ──────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  profilesTable: {},
  proficiencyScoresTable: {},
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

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as userRepo from "../src/auth/userRepo";
import * as profileRepo from "../src/profile/profileRepo";
import { DOMAINS } from "@workspace/shared/profile";

// ── In-memory stores ─────────────────────────────────────────────────────────

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

type StoredProfile = {
  userId: string;
  displayName: string | null;
  birthYear: number | null;
  focusDomain: string | null;
  relaxedMode: boolean;
  timerScale: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredScore = {
  id: string;
  userId: string;
  domain: string;
  score: number;
  updatedAt: Date;
};

let users: Map<string, StoredUser>;
let profiles: Map<string, StoredProfile>;
let scores: Map<string, StoredScore>; // key: `${userId}:${domain}`

beforeEach(() => {
  users = new Map();
  profiles = new Map();
  scores = new Map();

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

  vi.mocked(profileRepo.getProfileByUserId).mockImplementation(async (id) =>
    profiles.get(id) ?? null,
  );
  vi.mocked(profileRepo.upsertProfile).mockImplementation(async (id, data) => {
    const existing = profiles.get(id);
    const next: StoredProfile = {
      userId: id,
      displayName: data.displayName ?? existing?.displayName ?? null,
      birthYear: data.birthYear ?? existing?.birthYear ?? null,
      focusDomain: data.focusDomain ?? existing?.focusDomain ?? null,
      relaxedMode: data.relaxedMode ?? existing?.relaxedMode ?? true,
      timerScale: data.timerScale ?? existing?.timerScale ?? 100,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    profiles.set(id, next);
    return next;
  });
  vi.mocked(profileRepo.getProficiencyScores).mockImplementation(async (id) =>
    [...scores.values()].filter((s) => s.userId === id),
  );
  vi.mocked(profileRepo.upsertProficiencyScores).mockImplementation(
    async (id, newScores) => {
      const inserted: StoredScore[] = [];
      for (const [domain, score] of Object.entries(newScores)) {
        const key = `${id}:${domain}`;
        const row: StoredScore = {
          id: crypto.randomUUID(),
          userId: id,
          domain,
          score,
          updatedAt: new Date(),
        };
        scores.set(key, row);
        inserted.push(row);
      }
      return inserted;
    },
  );
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function registerUser(email = "p@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/profile", () => {
  it("returns null profile and empty scores for new user", async () => {
    const { accessToken } = await registerUser("new@neurofit.app");

    const res = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toBeNull();
    expect(res.body.proficiencyScores).toEqual([]);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/profile");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/profile", () => {
  it("updates displayName and other fields", async () => {
    const { accessToken } = await registerUser("patch@neurofit.app");

    const res = await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Test User",
        birthYear: 1990,
        focusDomain: "memory",
        relaxedMode: false,
        timerScale: 150,
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.displayName).toBe("Test User");
    expect(res.body.profile.birthYear).toBe(1990);
    expect(res.body.profile.focusDomain).toBe("memory");
    expect(res.body.profile.relaxedMode).toBe(false);
    expect(res.body.profile.timerScale).toBe(150);
  });

  it("rejects invalid focusDomain", async () => {
    const { accessToken } = await registerUser("bad-domain@neurofit.app");

    const res = await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ focusDomain: "not-a-real-domain" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid timerScale", async () => {
    const { accessToken } = await registerUser("bad-scale@neurofit.app");

    const res = await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ timerScale: 999 });

    expect(res.status).toBe(400);
  });

  it("ignores unknown fields (strict schema)", async () => {
    const { accessToken } = await registerUser("strict@neurofit.app");

    const res = await request(app)
      .patch("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ displayName: "Ok", proficiencyScore: 9999 });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/profile/assessment", () => {
  it("creates exactly 6 ProficiencyScore rows (one per domain)", async () => {
    const { accessToken } = await registerUser("assess@neurofit.app");

    const answers = DOMAINS.flatMap((domain) => [
      { domain, correct: true },
      { domain, correct: false },
      { domain, correct: true },
    ]);

    const res = await request(app)
      .post("/api/profile/assessment")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ answers });

    expect(res.status).toBe(201);
    expect(res.body.proficiencyScores).toHaveLength(6);

    const returnedDomains = res.body.proficiencyScores
      .map((s: { domain: string }) => s.domain)
      .sort();
    expect(returnedDomains).toEqual([...DOMAINS].sort());
  });

  it("works with empty answers (skipped assessment)", async () => {
    const { accessToken } = await registerUser("skip@neurofit.app");

    const res = await request(app)
      .post("/api/profile/assessment")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ answers: [] });

    expect(res.status).toBe(201);
    expect(res.body.proficiencyScores).toHaveLength(6);
    for (const score of res.body.proficiencyScores) {
      expect(score.score).toBe(2000);
    }
  });

  it("rejects missing answers field", async () => {
    const { accessToken } = await registerUser("missing@neurofit.app");

    const res = await request(app)
      .post("/api/profile/assessment")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("Integration: register → assessment → profile reflects scores", () => {
  it("scores show up in subsequent GET /profile", async () => {
    const { accessToken } = await registerUser("integration@neurofit.app");

    const answers = [
      { domain: "vocabulary" as const, correct: true },
      { domain: "vocabulary" as const, correct: true },
      { domain: "math" as const, correct: false },
      { domain: "math" as const, correct: false },
    ];

    const submitRes = await request(app)
      .post("/api/profile/assessment")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ answers });
    expect(submitRes.status).toBe(201);

    const profileRes = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.proficiencyScores).toHaveLength(6);

    const byDomain = Object.fromEntries(
      profileRes.body.proficiencyScores.map((s: { domain: string; score: number }) => [
        s.domain,
        s.score,
      ]),
    );
    expect(byDomain.vocabulary).toBe(4000); // all correct
    expect(byDomain.math).toBe(500);        // all wrong
    expect(byDomain.reading).toBe(2000);    // skipped
  });
});
