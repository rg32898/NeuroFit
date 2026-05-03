import type { Subscription } from "@workspace/db";

export const REFUND_WINDOW_DAYS = 14;

export type RefundEligibility = {
  eligible: boolean;
  reason: string | null;
  daysRemaining: number;
  windowDays: number;
  lastChargeAt: Date | null;
  provider: Subscription["provider"];
  instructionsUrl: string | null;
  instructions: string;
};

const PROVIDER_INSTRUCTIONS: Record<
  string,
  { url: string | null; text: string }
> = {
  apple: {
    url: "https://reportaproblem.apple.com",
    text: "Apple processes IAP refunds. Tap below to open Apple's report-a-problem page; refunds are usually decided within 48 hours.",
  },
  google: {
    url: "https://support.google.com/googleplay/answer/2479637",
    text: "Google processes Play Store refunds. Tap below to open Google Play's refund page; auto-approval applies within 48 hours of purchase, otherwise a human reviews.",
  },
  stripe: {
    url: null,
    text: "We'll process your card refund directly. Submitting will open a refund request — you'll get an email confirmation, and the refund typically lands in 5-10 business days.",
  },
};

/**
 * FR-6.7 — self-service refund window. We don't store `lastChargeAt`
 * explicitly, so we infer it from `currentPeriodEnd` minus the plan
 * period. Within 14 days of that inferred charge, the user is eligible.
 */
export function computeRefundEligibility(
  sub: Subscription | null,
  now: Date = new Date(),
): RefundEligibility {
  const provider = sub?.provider ?? "none";
  const baseInstructions =
    PROVIDER_INSTRUCTIONS[provider] ?? {
      url: null,
      text: "We can't process a refund without an active paid plan on file.",
    };

  if (!sub || sub.plan === "free" || provider === "none") {
    return {
      eligible: false,
      reason: "NO_PAID_SUBSCRIPTION",
      daysRemaining: 0,
      windowDays: REFUND_WINDOW_DAYS,
      lastChargeAt: null,
      provider,
      instructionsUrl: baseInstructions.url,
      instructions: baseInstructions.text,
    };
  }

  if (!sub.currentPeriodEnd) {
    return {
      eligible: false,
      reason: "NO_CHARGE_ON_FILE",
      daysRemaining: 0,
      windowDays: REFUND_WINDOW_DAYS,
      lastChargeAt: null,
      provider,
      instructionsUrl: baseInstructions.url,
      instructions: baseInstructions.text,
    };
  }

  const periodMs =
    sub.plan === "yearly"
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
  const lastChargeAt = new Date(sub.currentPeriodEnd.getTime() - periodMs);
  const windowEnd = new Date(
    lastChargeAt.getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const msRemaining = windowEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  const eligible = msRemaining > 0;

  return {
    eligible,
    reason: eligible ? null : "WINDOW_EXPIRED",
    daysRemaining,
    windowDays: REFUND_WINDOW_DAYS,
    lastChargeAt,
    provider,
    instructionsUrl: baseInstructions.url,
    instructions: baseInstructions.text,
  };
}
