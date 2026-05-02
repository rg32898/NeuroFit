import { z } from "zod";

export const SUBSCRIPTION_PROVIDERS = [
  "apple",
  "google",
  "stripe",
  "none",
] as const;
export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

export const SUBSCRIPTION_STATUSES = [
  "free",
  "trialing",
  "active",
  "grace",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_PLAN_IDS = ["free", "monthly", "yearly"] as const;
export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLAN_IDS)[number];

/**
 * Public plan catalogue. Prices, currency, period, and trial days are all
 * shown to the user BEFORE they enter the paywall (FR-6.6 — no surprise
 * auto-renew). Provider productIds map to App Store / Play / Stripe SKUs.
 */
export const SUBSCRIPTION_PLANS = [
  {
    id: "monthly" as const,
    title: "NeuroFit Monthly",
    priceCents: 999,
    currency: "USD",
    period: "month" as const,
    trialDays: 7,
    productIds: {
      apple: "neurofit_monthly_v1",
      google: "neurofit_monthly_v1",
      stripe: "neurofit_monthly_v1",
    },
  },
  {
    id: "yearly" as const,
    title: "NeuroFit Yearly",
    priceCents: 7999,
    currency: "USD",
    period: "year" as const,
    trialDays: 7,
    productIds: {
      apple: "neurofit_yearly_v1",
      google: "neurofit_yearly_v1",
      stripe: "neurofit_yearly_v1",
    },
  },
] as const;

export function planFromProductId(
  productId: string,
): SubscriptionPlanId | null {
  for (const plan of SUBSCRIPTION_PLANS) {
    if (
      plan.productIds.apple === productId ||
      plan.productIds.google === productId ||
      plan.productIds.stripe === productId
    ) {
      return plan.id;
    }
  }
  return null;
}

// ── Request bodies ───────────────────────────────────────────────────────────

export const validateReceiptSchema = z
  .object({
    provider: z.enum(["apple", "google"]),
    receipt: z.string().min(1),
    productId: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (v) => v.provider !== "google" || !!v.productId,
    { message: "productId is required for google receipts", path: ["productId"] },
  );

export type ValidateReceiptBody = z.infer<typeof validateReceiptSchema>;

/**
 * Provider-agnostic shape returned by every billing/*.ts verifier.
 * `validateAndSync` writes this into the subscriptions row.
 */
export type ValidatedReceipt = {
  provider: Exclude<SubscriptionProvider, "none">;
  status: SubscriptionStatus;
  plan: SubscriptionPlanId;
  providerSubscriptionId: string;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
};
