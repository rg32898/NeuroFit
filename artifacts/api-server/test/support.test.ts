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

vi.mock("../src/support/supportRepo", () => ({
  createSupportTicket: vi.fn(),
  findTicketByIdForUser: vi.fn(),
}));

vi.mock("../src/services/notifications", () => ({
  sendEmail: vi.fn(),
  sendPush: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import request from "supertest";
import app from "../src/app";
import * as userRepo from "../src/auth/userRepo";
import * as supportRepo from "../src/support/supportRepo";
import * as notifications from "../src/services/notifications";
import type { SupportTicket, User } from "@workspace/db";

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
let tickets: SupportTicket[];

beforeEach(() => {
  users = new Map();
  tickets = [];

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

  vi.mocked(supportRepo.createSupportTicket).mockImplementation(
    async (input) => {
      const t: SupportTicket = {
        id: crypto.randomUUID(),
        userId: input.userId,
        category: input.category,
        subject: input.subject,
        body: input.body,
        status: "open",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tickets.push(t);
      return t;
    },
  );
  vi.mocked(supportRepo.findTicketByIdForUser).mockImplementation(
    async (id, userId) =>
      tickets.find((t) => t.id === id && t.userId === userId) ?? null,
  );

  vi.mocked(notifications.sendEmail).mockResolvedValue({
    status: "logged",
    channel: "log",
    provider: "log",
  });
});

async function registerUser(email = "support@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string }; accessToken: string };
}

describe("POST /api/support/tickets", () => {
  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/support/tickets")
      .send({ category: "bug", subject: "x", body: "y" });
    expect(res.status).toBe(401);
  });

  it("rejects invalid payload (bad category, empty body)", async () => {
    const { accessToken } = await registerUser("bad@neurofit.app");
    const res = await request(app)
      .post("/api/support/tickets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ category: "nope", subject: "Help", body: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(tickets).toHaveLength(0);
  });

  it("creates a ticket and sends an acknowledgement email", async () => {
    const { accessToken, user } = await registerUser("ok@neurofit.app");

    const res = await request(app)
      .post("/api/support/tickets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        category: "billing",
        subject: "Charged twice",
        body: "I was charged twice for the monthly plan on March 1.",
      });

    expect(res.status).toBe(201);
    expect(res.body.ticket.userId).toBe(user.id);
    expect(res.body.ticket.status).toBe("open");
    expect(tickets).toHaveLength(1);

    expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        to: "ok@neurofit.app",
        kind: "support_ack",
        template: "support_ack.v1",
      }),
    );
  });
});

describe("GET /api/support/tickets/:id", () => {
  it("returns the ticket when the caller owns it", async () => {
    const { accessToken } = await registerUser("owner@neurofit.app");

    const create = await request(app)
      .post("/api/support/tickets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ category: "bug", subject: "Crashes", body: "App crashes on launch" });

    const ticketId = create.body.ticket.id;

    const res = await request(app)
      .get(`/api/support/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket.id).toBe(ticketId);
    expect(res.body.ticket.status).toBe("open");
  });

  it("returns 404 when another user tries to read someone else's ticket", async () => {
    const owner = await registerUser("ownr@neurofit.app");
    const intruder = await registerUser("hax@neurofit.app");

    const create = await request(app)
      .post("/api/support/tickets")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ category: "bug", subject: "Mine", body: "Mine alone" });

    const res = await request(app)
      .get(`/api/support/tickets/${create.body.ticket.id}`)
      .set("Authorization", `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});
