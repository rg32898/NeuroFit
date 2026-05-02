import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted) ──────────────────────────────────────────────────────────

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
  billingEventsTable: {},
  notificationsTable: {},
  pushTokensTable: {},
  contentReportsTable: {},
  supportTicketsTable: {},
}));

vi.mock("../src/billing/billingRepo", () => ({
  getSubscription: vi.fn(),
  upsertSubscription: vi.fn(),
  markCancelAtPeriodEnd: vi.fn(),
  insertBillingEvent: vi.fn(),
  findTrialingNeedingReminder: vi.fn(),
  markReminderSent: vi.fn(),
  findPaymentsNeedingReceipt: vi.fn(),
}));

vi.mock("../src/services/notifications/notificationsRepo", () => ({
  logNotification: vi.fn(),
  findPushTokensForUser: vi.fn(),
}));

vi.mock("../src/services/billing/apple", () => ({
  verifyAppleReceipt: vi.fn(),
}));

vi.mock("../src/services/billing/google", () => ({
  verifyGooglePlayReceipt: vi.fn(),
}));

vi.mock("../src/services/billing/stripe", () => ({
  verifyWebhookSignature: vi.fn(),
  mapStripeEventToReceipt: vi.fn(),
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
import * as billingRepo from "../src/billing/billingRepo";
import * as appleBilling from "../src/services/billing/apple";
import * as stripeBilling from "../src/services/billing/stripe";
import * as userRepo from "../src/auth/userRepo";
import * as notificationsRepo from "../src/services/notifications/notificationsRepo";
import type {
  BillingEvent,
  Notification,
  Subscription,
  User,
} from "@workspace/db";
import type { ValidatedReceipt } from "@workspace/shared/subscription";

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
let subs: Map<string, Subscription>;
let billingEvents: BillingEvent[];
let notifications: Notification[];

beforeEach(() => {
  users = new Map();
  subs = new Map();
  billingEvents = [];
  notifications = [];

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

  vi.mocked(billingRepo.getSubscription).mockImplementation(
    async (userId) => subs.get(userId) ?? null,
  );
  vi.mocked(billingRepo.upsertSubscription).mockImplementation(
    async (userId, fields) => {
      const prev = subs.get(userId);
      const next: Subscription = {
        userId,
        ...fields,
        // Mirror the SQL "OR" semantics in upsertSubscription so tests
        // exercise the same sticky-cancel guarantee as the real DB.
        cancelAtPeriodEnd:
          (prev?.cancelAtPeriodEnd ?? false) || fields.cancelAtPeriodEnd,
        updatedAt: new Date(),
        trialReminderSentAt: prev?.trialReminderSentAt ?? null,
      };
      subs.set(userId, next);
      return next;
    },
  );
  vi.mocked(billingRepo.markCancelAtPeriodEnd).mockImplementation(
    async (userId) => {
      const cur = subs.get(userId);
      if (!cur) return null;
      if (!["trialing", "active", "grace"].includes(cur.status)) return null;
      const next: Subscription = {
        ...cur,
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      };
      subs.set(userId, next);
      return next;
    },
  );
  vi.mocked(billingRepo.insertBillingEvent).mockImplementation(async (input) => {
    const dup =
      input.providerEventId !== null &&
      billingEvents.find(
        (e) =>
          e.provider === input.provider &&
          e.providerEventId === input.providerEventId,
      );
    if (dup) return null;
    const ev: BillingEvent = {
      id: crypto.randomUUID(),
      userId: input.userId,
      provider: input.provider,
      eventType: input.eventType,
      providerEventId: input.providerEventId,
      status: input.status,
      payload: (input.payload ?? null) as unknown as BillingEvent["payload"],
      createdAt: new Date(),
    };
    billingEvents.push(ev);
    return ev;
  });
  vi.mocked(notificationsRepo.logNotification).mockImplementation(
    async (input) => {
      const n: Notification = {
        id: crypto.randomUUID(),
        userId: input.userId,
        kind: input.kind,
        channel: input.channel,
        template: input.template ?? null,
        recipient: input.recipient ?? null,
        status: input.status,
        payload: (input.payload ?? null) as unknown as Notification["payload"],
        error: input.error ?? null,
        createdAt: new Date(),
        sentAt:
          input.status === "sent" || input.status === "logged"
            ? new Date()
            : null,
      };
      notifications.push(n);
      return n;
    },
  );
  vi.mocked(notificationsRepo.findPushTokensForUser).mockResolvedValue([]);
  vi.mocked(billingRepo.findTrialingNeedingReminder).mockResolvedValue([]);
  vi.mocked(billingRepo.markReminderSent).mockResolvedValue(undefined);
  vi.mocked(billingRepo.findPaymentsNeedingReceipt).mockResolvedValue([]);
});

async function registerUser(email = "billing@neurofit.app") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string }; accessToken: string };
}

const FUTURE_PERIOD_END = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Plans (public)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/subscription/plans", () => {
  it("returns the public price list with currency, period, and trial-days", async () => {
    const res = await request(app).get("/api/subscription/plans");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans).toHaveLength(2);
    for (const p of res.body.plans) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("priceCents");
      expect(p).toHaveProperty("currency");
      expect(p).toHaveProperty("period");
      expect(p).toHaveProperty("trialDays");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /subscription
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/subscription", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/subscription");
    expect(res.status).toBe(401);
  });

  it("returns 'free' defaults when no subscription exists", async () => {
    const { accessToken } = await registerUser("noSub@neurofit.app");
    const res = await request(app)
      .get("/api/subscription")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("free");
    expect(res.body.plan).toBe("free");
    expect(res.body.cancelAtPeriodEnd).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscription/validate-receipt — Apple happy path
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/subscription/validate-receipt", () => {
  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/subscription/validate-receipt")
      .send({ provider: "apple", receipt: "x" });
    expect(res.status).toBe(401);
  });

  it("validates an Apple receipt and upserts the Subscription as 'active'", async () => {
    const { accessToken, user } = await registerUser("apple@neurofit.app");

    const validated: ValidatedReceipt = {
      provider: "apple",
      status: "active",
      plan: "monthly",
      providerSubscriptionId: "1000000999",
      currentPeriodEnd: FUTURE_PERIOD_END,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
    };
    vi.mocked(appleBilling.verifyAppleReceipt).mockResolvedValue(validated);

    const res = await request(app)
      .post("/api/subscription/validate-receipt")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "apple", receipt: "fake-base64-receipt" });

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe("active");
    expect(res.body.subscription.plan).toBe("monthly");
    expect(res.body.subscription.provider).toBe("apple");

    // Upserted into in-memory store.
    expect(subs.get(user.id)?.status).toBe("active");
    // Audit row written.
    expect(billingEvents).toHaveLength(1);
    expect(billingEvents[0]!.eventType).toBe("receipt_validated");
  });

  it("rejects invalid receipt body", async () => {
    const { accessToken } = await registerUser("invalid@neurofit.app");
    const res = await request(app)
      .post("/api/subscription/validate-receipt")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "apple" }); // missing receipt
    expect(res.status).toBe(400);
  });

  it("returns 400 when the verifier throws (invalid Apple status code)", async () => {
    const { accessToken } = await registerUser("badreceipt@neurofit.app");
    vi.mocked(appleBilling.verifyAppleReceipt).mockRejectedValue(
      new Error("Apple receipt invalid (status 21002)"),
    );

    const res = await request(app)
      .post("/api/subscription/validate-receipt")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "apple", receipt: "bad" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RECEIPT_INVALID");
    expect(subs.size).toBe(0);
    expect(billingEvents).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscription/cancel
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/subscription/cancel", () => {
  it("flips cancelAtPeriodEnd to true and retains currentPeriodEnd", async () => {
    const { accessToken, user } = await registerUser("cancel@neurofit.app");

    subs.set(user.id, {
      userId: user.id,
      status: "active",
      plan: "monthly",
      provider: "apple",
      providerSubscriptionId: "1000000999",
      currentPeriodEnd: FUTURE_PERIOD_END,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      trialReminderSentAt: null,
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/subscription/cancel")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.cancelAtPeriodEnd).toBe(true);
    expect(res.body.subscription.status).toBe("active"); // status unchanged
    expect(new Date(res.body.endsOn).toISOString()).toBe(
      FUTURE_PERIOD_END.toISOString(),
    );

    // currentPeriodEnd preserved in the store.
    expect(subs.get(user.id)?.currentPeriodEnd?.toISOString()).toBe(
      FUTURE_PERIOD_END.toISOString(),
    );
    // Audit row recorded.
    expect(
      billingEvents.find((e) => e.eventType === "subscription_canceled"),
    ).toBeTruthy();
  });

  it("returns 400 when there is no active subscription", async () => {
    const { accessToken } = await registerUser("nosub@neurofit.app");
    const res = await request(app)
      .post("/api/subscription/cancel")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NO_ACTIVE_SUBSCRIPTION");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/stripe", () => {
  it("rejects with 400 when stripe-signature header is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send({ id: "evt_test", type: "customer.subscription.updated" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_SIGNATURE");
    expect(subs.size).toBe(0);
    expect(billingEvents).toHaveLength(0);
  });

  it("rejects with 400 on signature mismatch (no state change)", async () => {
    vi.mocked(stripeBilling.verifyWebhookSignature).mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=deadbeef")
      .send({ id: "evt_test", type: "customer.subscription.updated" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_SIGNATURE");
    expect(subs.size).toBe(0);
    expect(billingEvents).toHaveLength(0);
  });

  it("processes a valid signed event and persists the subscription", async () => {
    const userId = "u-stripe";
    users.set(userId, {} as StoredUser);

    vi.mocked(stripeBilling.verifyWebhookSignature).mockReturnValue({
      id: "evt_valid",
      type: "customer.subscription.updated",
    } as unknown as ReturnType<typeof stripeBilling.verifyWebhookSignature>);
    vi.mocked(stripeBilling.mapStripeEventToReceipt).mockReturnValue({
      userId,
      providerEventId: "evt_valid",
      receipt: {
        provider: "stripe",
        status: "active",
        plan: "yearly",
        providerSubscriptionId: "sub_xyz",
        currentPeriodEnd: FUTURE_PERIOD_END,
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
      },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=valid")
      .send({ id: "evt_valid", type: "customer.subscription.updated" });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.handled).toBe(true);
    expect(subs.get(userId)?.status).toBe("active");
    expect(subs.get(userId)?.plan).toBe("yearly");
  });

  it("does NOT un-cancel a subscription if a stale webhook arrives after local cancel", async () => {
    const userId = "u-sticky";
    users.set(userId, {} as StoredUser);

    // User already cancelled locally — cancelAtPeriodEnd is true.
    subs.set(userId, {
      userId,
      status: "active",
      plan: "monthly",
      provider: "stripe",
      providerSubscriptionId: "sub_sticky",
      currentPeriodEnd: FUTURE_PERIOD_END,
      cancelAtPeriodEnd: true,
      trialEndsAt: null,
      trialReminderSentAt: null,
      updatedAt: new Date(),
    });

    // Stale webhook from BEFORE the cancel was reflected in Stripe — it
    // claims cancelAtPeriodEnd=false. We must keep the user's intent.
    vi.mocked(stripeBilling.verifyWebhookSignature).mockReturnValue({
      id: "evt_stale",
      type: "customer.subscription.updated",
    } as unknown as ReturnType<typeof stripeBilling.verifyWebhookSignature>);
    vi.mocked(stripeBilling.mapStripeEventToReceipt).mockReturnValue({
      userId,
      providerEventId: "evt_stale",
      receipt: {
        provider: "stripe",
        status: "active",
        plan: "monthly",
        providerSubscriptionId: "sub_sticky",
        currentPeriodEnd: FUTURE_PERIOD_END,
        trialEndsAt: null,
        cancelAtPeriodEnd: false, // <-- stale
      },
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=valid")
      .send({ id: "evt_stale", type: "customer.subscription.updated" });

    expect(res.status).toBe(200);
    expect(subs.get(userId)?.cancelAtPeriodEnd).toBe(true);
  });

  it("ack-200s but logs nothing for events we don't process (e.g. invoice.paid)", async () => {
    vi.mocked(stripeBilling.verifyWebhookSignature).mockReturnValue({
      id: "evt_invoice",
      type: "invoice.paid",
    } as unknown as ReturnType<typeof stripeBilling.verifyWebhookSignature>);
    vi.mocked(stripeBilling.mapStripeEventToReceipt).mockReturnValue(null);

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=valid")
      .send({ id: "evt_invoice", type: "invoice.paid" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, handled: false });
    expect(subs.size).toBe(0);
  });

  it("dedupes a replayed Stripe event (no duplicate audit row)", async () => {
    const userId = "u-replay";
    users.set(userId, {} as StoredUser);

    vi.mocked(stripeBilling.verifyWebhookSignature).mockReturnValue({
      id: "evt_replay",
      type: "customer.subscription.updated",
    } as unknown as ReturnType<typeof stripeBilling.verifyWebhookSignature>);
    vi.mocked(stripeBilling.mapStripeEventToReceipt).mockReturnValue({
      userId,
      providerEventId: "evt_replay",
      receipt: {
        provider: "stripe",
        status: "active",
        plan: "monthly",
        providerSubscriptionId: "sub_replay",
        currentPeriodEnd: FUTURE_PERIOD_END,
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
      },
    });

    await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=valid")
      .send({ id: "evt_replay", type: "customer.subscription.updated" });

    await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=valid")
      .send({ id: "evt_replay", type: "customer.subscription.updated" });

    const stripeEvents = billingEvents.filter(
      (e) => e.providerEventId === "evt_replay",
    );
    expect(stripeEvents).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Billing cron
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/cron/billing", () => {
  it("rejects without cron secret", async () => {
    const res = await request(app).post("/api/admin/cron/billing").send({});
    expect(res.status).toBe(401);
  });

  it("queues trial reminders + receipt notifications when called with the secret", async () => {
    const { config } = await import("../src/config");

    const trialingSub: Subscription = {
      userId: "u-trial",
      status: "trialing",
      plan: "monthly",
      provider: "apple",
      providerSubscriptionId: "1000",
      currentPeriodEnd: FUTURE_PERIOD_END,
      cancelAtPeriodEnd: false,
      trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h out
      trialReminderSentAt: null,
      updatedAt: new Date(),
    };
    vi.mocked(billingRepo.findTrialingNeedingReminder).mockResolvedValue([
      trialingSub,
    ]);
    vi.mocked(billingRepo.findPaymentsNeedingReceipt).mockResolvedValue([
      {
        id: "be-1",
        userId: "u-trial",
        provider: "apple",
        eventType: "receipt_validated",
        providerEventId: "1000",
        status: "active",
        payload: null,
        createdAt: new Date(),
      },
    ]);

    const res = await request(app)
      .post("/api/admin/cron/billing")
      .set("x-cron-secret", config.CRON_SECRET)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.remindersSent).toBe(1);
    expect(res.body.receiptsQueued).toBe(1);
    expect(notifications.find((n) => n.kind === "trial_reminder")).toBeTruthy();
    expect(notifications.find((n) => n.kind === "receipt")).toBeTruthy();
  });
});
