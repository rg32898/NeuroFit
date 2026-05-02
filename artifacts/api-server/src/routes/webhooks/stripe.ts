import type { Request, Response } from "express";
import {
  mapStripeEventToReceipt,
  verifyWebhookSignature,
} from "../../services/billing/stripe";
import { persistValidatedReceipt } from "../../services/billing";

/**
 * Stripe webhook. Mounted directly on the Express app (NOT inside the
 * /api router) so we can attach `express.raw({ type: "application/json" })`
 * BEFORE the global `express.json()`. Stripe's signature is computed over
 * the raw bytes — once `express.json()` parses the body the signature is
 * unrecoverable.
 *
 * Always returns 200 once the signature is valid, even for events we
 * don't handle, so Stripe stops retrying. Signature failures must return
 * a 4xx so Stripe DOES retry / alerts the dashboard.
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || signature.length === 0) {
    req.log?.warn("stripe.webhook.missing_signature");
    res.status(400).json({
      error: { code: "BAD_SIGNATURE", message: "Missing stripe-signature" },
    });
    return;
  }

  // express.raw() places the raw bytes on req.body as a Buffer.
  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    req.log?.warn("stripe.webhook.body_not_raw");
    res.status(400).json({
      error: { code: "BAD_BODY", message: "Webhook body was not raw bytes" },
    });
    return;
  }

  let event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    req.log?.warn(
      { err: (err as Error).message },
      "stripe.webhook.signature_invalid",
    );
    res.status(400).json({
      error: {
        code: "BAD_SIGNATURE",
        message: (err as Error).message,
      },
    });
    return;
  }

  const mapped = mapStripeEventToReceipt(event);
  if (!mapped) {
    // Two reasons we land here, with very different operational meaning:
    //   (a) Event type we don't process (e.g. invoice.paid) — ack & move on.
    //   (b) customer.subscription.* event but `metadata.userId` was missing
    //       on both the subscription and the customer. That's a CHECKOUT
    //       MISCONFIG — payment succeeded, no entitlement was provisioned.
    // We log (b) loudly so on-call sees "payment without provisioning".
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      req.log?.warn(
        { eventId: event.id, type: event.type },
        "stripe.webhook.subscription_event_missing_user_metadata",
      );
    }
    res.status(200).json({ received: true, handled: false });
    return;
  }

  await persistValidatedReceipt(mapped.userId, mapped.receipt, {
    eventType: event.type,
    providerEventId: mapped.providerEventId,
    payload: event,
  });

  res.status(200).json({ received: true, handled: true });
}
