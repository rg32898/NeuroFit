import type {
  Subscription,
} from "@workspace/db";
import type { ValidatedReceipt } from "@workspace/shared/subscription";
import {
  insertBillingEvent,
  upsertSubscription,
} from "../../billing/billingRepo";
import { verifyAppleReceipt } from "./apple";
import { verifyGooglePlayReceipt } from "./google";

export type ValidateInput =
  | { provider: "apple"; receipt: string }
  | { provider: "google"; productId: string; receipt: string };

/**
 * Provider-agnostic entry point used by POST /subscription/validate-receipt.
 *
 * Stripe is intentionally NOT validated here — Stripe's source of truth is
 * its own webhook stream, so the mobile/web client just opens Checkout and
 * waits for the customer.subscription.* event to reach our /webhooks/stripe.
 */
export async function validateAndSync(
  userId: string,
  input: ValidateInput,
): Promise<Subscription> {
  let validated: ValidatedReceipt;
  if (input.provider === "apple") {
    validated = await verifyAppleReceipt(input.receipt);
  } else {
    validated = await verifyGooglePlayReceipt(input.productId, input.receipt);
  }

  return persistValidatedReceipt(userId, validated, {
    eventType: "receipt_validated",
    providerEventId: validated.providerSubscriptionId,
  });
}

/**
 * Shared writer used by validate-receipt AND every webhook path. Always
 * records an audit row in billing_events with conflict-do-nothing on
 * (provider, providerEventId) so retried webhooks are no-ops.
 *
 * Returns the latest subscription row regardless of whether the audit
 * insert was a duplicate — the caller still wants to ack 200.
 */
export async function persistValidatedReceipt(
  userId: string,
  validated: ValidatedReceipt,
  audit: { eventType: string; providerEventId: string | null; payload?: unknown },
): Promise<Subscription> {
  await insertBillingEvent({
    userId,
    provider: validated.provider,
    eventType: audit.eventType,
    providerEventId: audit.providerEventId,
    status: validated.status,
    payload: audit.payload ?? validated,
  });

  return upsertSubscription(userId, {
    status: validated.status,
    plan: validated.plan,
    provider: validated.provider,
    providerSubscriptionId: validated.providerSubscriptionId,
    currentPeriodEnd: validated.currentPeriodEnd,
    cancelAtPeriodEnd: validated.cancelAtPeriodEnd,
    trialEndsAt: validated.trialEndsAt,
  });
}

export { verifyAppleReceipt, verifyGooglePlayReceipt };
export {
  verifyWebhookSignature,
  mapStripeEventToReceipt,
} from "./stripe";
