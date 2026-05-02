import Stripe from "stripe";
import type { ValidatedReceipt } from "@workspace/shared/subscription";
import { planFromProductId } from "@workspace/shared/subscription";
import { config } from "../../config";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  // Omitting apiVersion lets the SDK use its own pinned default — saves us
  // from having to bump a literal type every time we upgrade `stripe`.
  stripeClient = new Stripe(config.STRIPE_SECRET_KEY);
  return stripeClient;
}

/**
 * Verify a Stripe webhook signature using the shared SDK helper. Throws if
 * the signature header is missing, malformed, mismatched, or stale.
 *
 * `rawBody` MUST be the unparsed Buffer — see app.ts where /webhooks/stripe
 * is mounted with express.raw() before the global JSON parser.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
): Stripe.Event {
  if (!config.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    config.STRIPE_WEBHOOK_SECRET,
  );
}

/**
 * Map a Stripe event to a ValidatedReceipt + the user it applies to.
 * Returns null for events we don't handle (so the webhook can 200-ack).
 *
 * We only act on the canonical lifecycle events:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *
 * The Stripe checkout flow MUST set `metadata.userId` on the subscription
 * (or on the customer) so we can route the event to the right account.
 */
export function mapStripeEventToReceipt(
  event: Stripe.Event,
): { userId: string; receipt: ValidatedReceipt; providerEventId: string } | null {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return null;
  }

  const sub = event.data.object as Stripe.Subscription;
  const userId =
    (sub.metadata?.userId as string | undefined) ??
    (typeof sub.customer === "object"
      ? ((sub.customer as Stripe.Customer).metadata?.userId as
          | string
          | undefined)
      : undefined);
  if (!userId) return null;

  const item = sub.items.data[0];
  if (!item) return null;

  const productId =
    (item.price.metadata?.product_slug as string | undefined) ??
    (item.price.lookup_key ?? "");
  const plan = planFromProductId(productId);
  if (!plan || plan === "free") return null;

  let status: ValidatedReceipt["status"];
  switch (sub.status) {
    case "trialing":
      status = "trialing";
      break;
    case "active":
      status = "active";
      break;
    case "past_due":
    case "unpaid":
      status = "grace";
      break;
    case "canceled":
    case "incomplete_expired":
      status = "canceled";
      break;
    case "incomplete":
    case "paused":
    default:
      status = "expired";
  }

  // current_period_end may live on the item in newer API versions.
  const currentPeriodEndUnix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number }).current_period_end;
  const currentPeriodEnd = currentPeriodEndUnix
    ? new Date(currentPeriodEndUnix * 1000)
    : new Date(0);

  return {
    userId,
    providerEventId: event.id,
    receipt: {
      provider: "stripe",
      status,
      plan,
      providerSubscriptionId: sub.id,
      currentPeriodEnd,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  };
}
