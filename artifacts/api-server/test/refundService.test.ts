import { describe, expect, it } from "vitest";
import type { Subscription } from "@workspace/db";
import { computeRefundEligibility } from "../src/services/refundService";

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    userId: "u1",
    status: "active",
    plan: "monthly",
    provider: "stripe",
    providerSubscriptionId: "sub_x",
    currentPeriodEnd: new Date("2026-05-30T00:00:00Z"),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    trialReminderSentAt: null,
    updatedAt: new Date(),
    ...overrides,
  } as Subscription;
}

describe("computeRefundEligibility", () => {
  const now = new Date("2026-05-10T00:00:00Z");

  it("rejects when there is no subscription", () => {
    const r = computeRefundEligibility(null, now);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("NO_PAID_SUBSCRIPTION");
  });

  it("rejects free plan", () => {
    const r = computeRefundEligibility(
      sub({ plan: "free", provider: "none" }),
      now,
    );
    expect(r.eligible).toBe(false);
  });

  it("is eligible within 14 days of inferred last charge (monthly)", () => {
    // monthly: lastChargeAt = currentPeriodEnd - 30d = 2026-04-30
    // window expires 2026-05-14, now is 2026-05-10 → eligible, 4 days left
    const r = computeRefundEligibility(sub(), now);
    expect(r.eligible).toBe(true);
    expect(r.daysRemaining).toBe(4);
    expect(r.windowDays).toBe(14);
    expect(r.provider).toBe("stripe");
    expect(r.lastChargeAt).toEqual(new Date("2026-04-30T00:00:00Z"));
  });

  it("rejects when the window has expired", () => {
    // last charge 2026-03-01 → window expired 2026-03-15
    const r = computeRefundEligibility(
      sub({ currentPeriodEnd: new Date("2026-03-31T00:00:00Z") }),
      now,
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("WINDOW_EXPIRED");
    expect(r.daysRemaining).toBe(0);
  });

  it("uses 365-day inference for yearly plans", () => {
    // yearly: lastChargeAt = currentPeriodEnd - 365d
    const r = computeRefundEligibility(
      sub({
        plan: "yearly",
        currentPeriodEnd: new Date("2027-05-01T00:00:00Z"),
      }),
      now,
    );
    expect(r.eligible).toBe(true);
    expect(r.lastChargeAt).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("returns provider-specific instructions for apple", () => {
    const r = computeRefundEligibility(sub({ provider: "apple" }), now);
    expect(r.provider).toBe("apple");
    expect(r.instructionsUrl).toBe("https://reportaproblem.apple.com");
    expect(r.instructions).toMatch(/Apple/);
  });

  it("returns null URL for stripe (handled in-app)", () => {
    const r = computeRefundEligibility(sub({ provider: "stripe" }), now);
    expect(r.instructionsUrl).toBeNull();
  });
});
