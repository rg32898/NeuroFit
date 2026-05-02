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

vi.mock("../src/services/notifications/notificationsRepo", () => ({
  logNotification: vi.fn(),
  findPushTokensForUser: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { sendEmail } from "../src/services/notifications/email";
import { sendPush } from "../src/services/notifications/push";
import * as repo from "../src/services/notifications/notificationsRepo";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Clear cached config so env stubs take effect.
  vi.resetModules();
  vi.mocked(repo.logNotification).mockResolvedValue({} as never);
  vi.mocked(repo.findPushTokensForUser).mockResolvedValue([]);
});

describe("sendEmail", () => {
  it("falls back to log channel and does NOT throw when no transport is configured", async () => {
    // No SMTP_HOST / RESEND_API_KEY in env. Default config has neither.
    const result = await sendEmail({
      userId: "u-1",
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>hi</p>",
      kind: "welcome",
      template: "welcome.v1",
    });

    expect(result.status).toBe("logged");
    expect(result.channel).toBe("log");
    expect(result.provider).toBe("log");

    expect(repo.logNotification).toHaveBeenCalledTimes(1);
    expect(repo.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        kind: "welcome",
        channel: "log",
        status: "logged",
        recipient: "user@example.com",
      }),
    );
  });

  it("blocks marketing sends without an explicit opt-in (FR-8.4)", async () => {
    const result = await sendEmail({
      userId: "u-2",
      to: "user@example.com",
      subject: "Sale!",
      html: "<p>Buy now</p>",
      kind: "newsletter",
      template: "newsletter.v1",
      marketing: true,
      // marketingOptIn omitted -> false
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("marketing_send_without_optin");
    expect(repo.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "marketing_send_without_optin",
      }),
    );
  });

  it("survives a logNotification write failure (never throws)", async () => {
    vi.mocked(repo.logNotification).mockRejectedValueOnce(
      new Error("DB down"),
    );
    await expect(
      sendEmail({
        userId: "u-3",
        to: "user@example.com",
        subject: "x",
        html: "x",
        kind: "x",
      }),
    ).resolves.toMatchObject({ status: "logged" });
  });
});

describe("sendPush", () => {
  it("blocks marketing pushes without an explicit opt-in (FR-8.4)", async () => {
    const result = await sendPush({
      userId: "u-mkt",
      title: "Sale!",
      body: "Buy now",
      kind: "promo",
      marketing: true,
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("marketing_send_without_optin");
    expect(repo.findPushTokensForUser).not.toHaveBeenCalled();
    expect(repo.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", channel: "log" }),
    );
  });

  it("logs without throwing when the user has no push tokens registered", async () => {
    vi.mocked(repo.findPushTokensForUser).mockResolvedValueOnce([]);

    const result = await sendPush({
      userId: "u-1",
      title: "Hi",
      body: "There",
      kind: "test",
    });

    expect(result.status).toBe("logged");
    expect(result.tokensTried).toBe(0);
    expect(repo.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "log",
        status: "logged",
        payload: expect.objectContaining({ reason: "no_tokens" }),
      }),
    );
  });

  it("logs (does not POST) when tokens exist but EXPO_ACCESS_TOKEN is missing", async () => {
    vi.mocked(repo.findPushTokensForUser).mockResolvedValueOnce([
      {
        id: "t-1",
        userId: "u-1",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await sendPush({
      userId: "u-1",
      title: "Hi",
      body: "There",
      kind: "test",
    });

    expect(result.status).toBe("logged");
    expect(result.tokensTried).toBe(1);
  });
});
