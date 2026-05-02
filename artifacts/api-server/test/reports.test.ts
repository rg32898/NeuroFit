import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

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
  billingEventsTable: {},
  notificationsTable: {},
  pushTokensTable: {},
  contentReportsTable: {},
  supportTicketsTable: {},
}));

vi.mock("../src/auth/userRepo", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  incrementTokenVersion: vi.fn(),
}));

vi.mock("../src/reports/reportRepo", () => ({
  createOrFindOpenContentReport: vi.fn(),
  listReportsByReporter: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as userRepo from "../src/auth/userRepo";
import * as reportRepo from "../src/reports/reportRepo";
import type { ContentReport, User } from "@workspace/db";

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
let reports: ContentReport[];

beforeEach(() => {
  users = new Map();
  reports = [];

  vi.mocked(userRepo.findUserByEmail).mockImplementation(
    async (email) =>
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

  vi.mocked(reportRepo.createOrFindOpenContentReport).mockImplementation(
    async (input) => {
      const existing = reports.find(
        (r) =>
          r.reporterId === input.reporterId &&
          r.gameItemId === input.gameItemId &&
          r.status === "open",
      );
      if (existing) return { report: existing, idempotent: true };
      const r: ContentReport = {
        id: crypto.randomUUID(),
        reporterId: input.reporterId,
        gameItemId: input.gameItemId,
        category: input.category,
        message: input.message,
        status: "open",
        createdAt: new Date(),
      };
      reports.push(r);
      return { report: r, idempotent: false };
    },
  );
  vi.mocked(reportRepo.listReportsByReporter).mockImplementation(
    async (reporterId) =>
      reports.filter((r) => r.reporterId === reporterId),
  );
});

async function registerUser(email = "reporter@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string }; accessToken: string };
}

describe("POST /api/reports/content", () => {
  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/reports/content")
      .send({ gameItemId: "g-1", category: "broken", message: "won't load" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid payload (missing fields, bad category)", async () => {
    const { accessToken } = await registerUser("invalid@neurofit.app");
    const res = await request(app)
      .post("/api/reports/content")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ gameItemId: "g-1", category: "lol", message: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(reports).toHaveLength(0);
  });

  it("creates a report and returns 201", async () => {
    const { accessToken, user } = await registerUser("ok@neurofit.app");

    const res = await request(app)
      .post("/api/reports/content")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gameItemId: "game-item-42",
        category: "broken",
        message: "Crashes after the third tap",
      });

    expect(res.status).toBe(201);
    expect(res.body.idempotent).toBe(false);
    expect(res.body.report.gameItemId).toBe("game-item-42");
    expect(res.body.report.reporterId).toBe(user.id);
    expect(reports).toHaveLength(1);
  });

  it("is idempotent: a duplicate report on the same item from the same user within 24h returns the original", async () => {
    const { accessToken, user } = await registerUser("dupe@neurofit.app");

    const first = await request(app)
      .post("/api/reports/content")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gameItemId: "game-item-99",
        category: "spam",
        message: "Same complaint",
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/reports/content")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        gameItemId: "game-item-99",
        category: "spam",
        message: "Same complaint, slightly different wording",
      });

    expect(second.status).toBe(200);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.report.id).toBe(first.body.report.id);
    expect(second.body.report.reporterId).toBe(user.id);
    // Only one row created.
    expect(reports).toHaveLength(1);
  });
});

describe("GET /api/reports/mine", () => {
  it("returns the caller's own reports only", async () => {
    const a = await registerUser("a@neurofit.app");
    const b = await registerUser("b@neurofit.app");

    await request(app)
      .post("/api/reports/content")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ gameItemId: "g-a", category: "other", message: "hi" });
    await request(app)
      .post("/api/reports/content")
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({ gameItemId: "g-b", category: "other", message: "hi" });

    const res = await request(app)
      .get("/api/reports/mine")
      .set("Authorization", `Bearer ${a.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0].reporterId).toBe(a.user.id);
  });
});
