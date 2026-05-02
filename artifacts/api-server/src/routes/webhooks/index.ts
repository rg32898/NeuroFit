import { Router, type Request, type Response } from "express";
import { insertBillingEvent } from "../../billing/billingRepo";

const router = Router();

/**
 * POST /webhooks/apple — App Store Server Notifications V2.
 *
 * Apple sends `{ "signedPayload": "<JWS>" }`. Full JWS verification requires
 * pinning Apple's root cert chain, which is in the Prompt 10 scope. For now
 * we parse the unverified payload (best-effort) and persist it as a
 * billing_event so the audit log captures the notification. We deliberately
 * DO NOT mutate the subscription state from an unverified Apple payload.
 */
router.post("/apple", async (req: Request, res: Response) => {
  const { signedPayload } = (req.body ?? {}) as { signedPayload?: string };
  if (typeof signedPayload !== "string") {
    res.status(400).json({
      error: { code: "BAD_BODY", message: "Missing signedPayload" },
    });
    return;
  }

  const parts = signedPayload.split(".");
  let parsed: Record<string, unknown> | null = null;
  if (parts.length === 3 && parts[1]) {
    try {
      parsed = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8"),
      ) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const notificationUuid =
    (parsed?.notificationUUID as string | undefined) ?? null;
  const userId = (parsed?.userId as string | undefined) ?? "unknown";

  await insertBillingEvent({
    userId,
    provider: "apple",
    eventType: (parsed?.notificationType as string | undefined) ?? "webhook",
    providerEventId: notificationUuid,
    status: "received",
    payload: parsed ?? { signedPayload },
  });

  res.status(200).json({ received: true });
});

/**
 * POST /webhooks/google — Real-time Developer Notifications via Pub/Sub.
 *
 * Google wraps the message in a Pub/Sub envelope: { message: { data: <b64> }}.
 * Push-subscription auth (OIDC token in Authorization) is the production
 * verification mechanism; configure it in Pub/Sub and add a check here in
 * Prompt 10. For now we parse + log to the audit table.
 */
router.post("/google", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    message?: { data?: string; messageId?: string };
  };
  const data = body.message?.data;
  let parsed: Record<string, unknown> | null = null;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(
        Buffer.from(data, "base64").toString("utf8"),
      ) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const userId = (parsed?.userId as string | undefined) ?? "unknown";
  const eventId = body.message?.messageId ?? null;

  await insertBillingEvent({
    userId,
    provider: "google",
    eventType:
      (parsed?.subscriptionNotification as { notificationType?: string })
        ?.notificationType?.toString() ?? "webhook",
    providerEventId: eventId,
    status: "received",
    payload: parsed ?? body,
  });

  res.status(200).json({ received: true });
});

export default router;
