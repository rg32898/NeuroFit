import { Router, type Request, type Response } from "express";
import {
  SUBSCRIPTION_PLANS,
  validateReceiptSchema,
} from "@workspace/shared/subscription";
import { requireAuth } from "../middlewares/requireAuth";
import { getSubscription } from "../billing/billingRepo";
import { validateAndSync } from "../services/billing";
import { cancelSubscription } from "../services/billingService";

const router = Router();

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

/** GET /subscription — current entitlement snapshot for the user. */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const sub = await getSubscription(req.user!.id);
  res.json({
    status: sub?.status ?? "free",
    plan: sub?.plan ?? "free",
    provider: sub?.provider ?? "none",
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    trialEndsAt: sub?.trialEndsAt ?? null,
  });
});

/**
 * GET /subscription/plans — public price list. Explicit currency, period,
 * and trial-day count satisfy FR-6.6 (no surprise auto-renew). Auth-free
 * so the marketing site / app paywall can render before login.
 */
router.get("/plans", (_req: Request, res: Response) => {
  res.json({
    plans: SUBSCRIPTION_PLANS.map((p) => ({
      id: p.id,
      title: p.title,
      priceCents: p.priceCents,
      currency: p.currency,
      period: p.period,
      trialDays: p.trialDays,
      productIds: p.productIds,
    })),
  });
});

/**
 * POST /subscription/validate-receipt — mobile sends a store receipt; the
 * server verifies with Apple/Google and upserts the local subscription.
 */
router.post(
  "/validate-receipt",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = validateReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Invalid receipt body",
          requestId: reqId(req),
        },
      });
      return;
    }

    try {
      const sub =
        parsed.data.provider === "apple"
          ? await validateAndSync(req.user!.id, {
              provider: "apple",
              receipt: parsed.data.receipt,
            })
          : await validateAndSync(req.user!.id, {
              provider: "google",
              productId: parsed.data.productId!,
              receipt: parsed.data.receipt,
            });

      res.status(200).json({
        subscription: {
          status: sub.status,
          plan: sub.plan,
          provider: sub.provider,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          trialEndsAt: sub.trialEndsAt,
        },
      });
    } catch (err) {
      req.log?.warn(
        { err: (err as Error).message, provider: parsed.data.provider },
        "subscription.validate_receipt_failed",
      );
      res.status(400).json({
        error: {
          code: "RECEIPT_INVALID",
          message: (err as Error).message,
          requestId: reqId(req),
        },
      });
    }
  },
);

/**
 * POST /subscription/cancel — sets cancelAtPeriodEnd=true. We do NOT call
 * the store APIs (in-app purchases must be cancelled in the device's
 * subscription settings); the store eventually pushes a webhook that
 * confirms the final state.
 */
router.post("/cancel", requireAuth, async (req: Request, res: Response) => {
  const sub = await cancelSubscription(req.user!.id);
  if (!sub) {
    res.status(400).json({
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "No active or trialing subscription to cancel",
        requestId: reqId(req),
      },
    });
    return;
  }

  res.json({
    subscription: {
      status: sub.status,
      plan: sub.plan,
      provider: sub.provider,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
    endsOn: sub.currentPeriodEnd,
  });
});

export default router;
