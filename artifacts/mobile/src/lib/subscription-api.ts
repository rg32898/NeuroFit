import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "grace"
  | "canceled"
  | "expired";

export type SubscriptionProvider = "none" | "apple" | "google" | "stripe";

export type SubscriptionPlanId = "free" | "monthly" | "yearly";

export type SubscriptionSummary = {
  status: SubscriptionStatus;
  plan: SubscriptionPlanId;
  provider: SubscriptionProvider;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
};

export type Plan = {
  id: "monthly" | "yearly";
  title: string;
  priceCents: number;
  currency: string;
  period: "month" | "year";
  trialDays: number;
};

export type RefundEligibility = {
  eligible: boolean;
  reason: string | null;
  daysRemaining: number;
  windowDays: number;
  lastChargeAt: string | null;
  provider: SubscriptionProvider;
  instructionsUrl: string | null;
  instructions: string;
};

export const SUBSCRIPTION_QK = {
  status: ["subscription", "status"] as const,
  plans: ["subscription", "plans"] as const,
  refundEligibility: ["subscription", "refund-eligibility"] as const,
};

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: SUBSCRIPTION_QK.status,
    queryFn: () => api.get<SubscriptionSummary>("/api/subscription"),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: SUBSCRIPTION_QK.plans,
    queryFn: () => api.get<{ plans: Plan[] }>("/api/subscription/plans"),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{
        subscription: SubscriptionSummary;
        endsOn: string | null;
      }>("/api/subscription/cancel", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBSCRIPTION_QK.status });
    },
  });
}

export function useRefundEligibility() {
  return useQuery({
    queryKey: SUBSCRIPTION_QK.refundEligibility,
    queryFn: () =>
      api.get<RefundEligibility>("/api/subscription/refund-eligibility"),
  });
}

export function useRequestRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ requested: boolean; eligibility: RefundEligibility }>(
        "/api/subscription/refund-request",
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBSCRIPTION_QK.refundEligibility });
    },
  });
}

/** Format cents to a localized currency string. Pure helper for tests. */
export function formatPrice(priceCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `$${(priceCents / 100).toFixed(2)}`;
  }
}

/** "$6.67/mo equivalent" string for an annual plan. Pure. */
export function annualPerMonthEquivalent(plan: Plan): string {
  const perMonthCents = Math.round(plan.priceCents / 12);
  return formatPrice(perMonthCents, plan.currency);
}
