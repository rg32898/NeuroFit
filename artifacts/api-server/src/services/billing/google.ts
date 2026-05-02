import { GoogleAuth } from "google-auth-library";
import type { ValidatedReceipt } from "@workspace/shared/subscription";
import { planFromProductId } from "@workspace/shared/subscription";
import { config } from "../../config";

let cachedAuth: GoogleAuth | null = null;

function loadServiceAccount(): object {
  const raw = config.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured");
  }
  // Accept either a file path OR a base64-encoded JSON blob (env-var friendly).
  if (raw.trim().startsWith("{")) {
    return JSON.parse(raw);
  }
  // Heuristic: if it doesn't look like a JSON object, try base64.
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.trim().startsWith("{")) return JSON.parse(decoded);
  } catch {
    // fall through to file-path interpretation
  }
  // Otherwise treat as a file path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  return JSON.parse(fs.readFileSync(raw, "utf8"));
}

function getAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;
  const credentials = loadServiceAccount();
  cachedAuth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return cachedAuth;
}

/**
 * Google Play Subscriptions V2 response (subset we care about).
 * https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
 */
type GoogleSubscriptionResponse = {
  subscriptionState?:
    | "SUBSCRIPTION_STATE_ACTIVE"
    | "SUBSCRIPTION_STATE_CANCELED"
    | "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    | "SUBSCRIPTION_STATE_ON_HOLD"
    | "SUBSCRIPTION_STATE_EXPIRED"
    | "SUBSCRIPTION_STATE_PENDING";
  lineItems?: Array<{
    productId: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    /**
     * Offers in Play V2 represent introductory pricing or free trials. A
     * non-empty offerId on an ACTIVE line item is the most reliable signal
     * that the user is in their trial period — the base plan has no offerId.
     */
    offerDetails?: { offerId?: string; basePlanId?: string };
  }>;
  paidRecurringInfo?: { autoRenewEnabled?: boolean };
  testPurchase?: object;
  startTime?: string;
};

export async function verifyGooglePlayReceipt(
  productId: string,
  purchaseToken: string,
): Promise<ValidatedReceipt> {
  if (!config.GOOGLE_PLAY_PACKAGE_NAME) {
    throw new Error("GOOGLE_PLAY_PACKAGE_NAME is not configured");
  }
  const auth = getAuth();
  const client = await auth.getClient();

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    config.GOOGLE_PLAY_PACKAGE_NAME,
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await client.request<GoogleSubscriptionResponse>({ url });
  const data = res.data;

  const lineItem = data.lineItems?.find((l) => l.productId === productId);
  if (!lineItem) {
    throw new Error(`Google receipt has no lineItem for ${productId}`);
  }

  const plan = planFromProductId(productId);
  if (!plan || plan === "free") {
    throw new Error(`Unknown Google productId: ${productId}`);
  }

  const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
  if (!expiresAt) {
    throw new Error("Google receipt missing expiryTime");
  }

  let status: ValidatedReceipt["status"];
  switch (data.subscriptionState) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      status = "active";
      break;
    case "SUBSCRIPTION_STATE_CANCELED":
      status = "canceled";
      break;
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
    case "SUBSCRIPTION_STATE_ON_HOLD":
      status = "grace";
      break;
    case "SUBSCRIPTION_STATE_EXPIRED":
      status = "expired";
      break;
    default:
      status = "active";
  }

  const cancelAtPeriodEnd =
    lineItem.autoRenewingPlan?.autoRenewEnabled === false ||
    data.paidRecurringInfo?.autoRenewEnabled === false;

  // FR-6.3: trial reminders need a real trialEndsAt value. Google's V2 API
  // doesn't have an explicit "isTrial" flag like Apple does, but a
  // non-empty offerId on an ACTIVE subscription means the user is on an
  // intro offer (free trial / discounted weeks) rather than the base plan.
  const isTrialOffer =
    status === "active" && !!lineItem.offerDetails?.offerId;
  const reportedStatus: ValidatedReceipt["status"] = isTrialOffer
    ? "trialing"
    : status;

  return {
    provider: "google",
    status: reportedStatus,
    plan,
    providerSubscriptionId: purchaseToken,
    currentPeriodEnd: expiresAt,
    trialEndsAt: isTrialOffer ? expiresAt : null,
    cancelAtPeriodEnd,
  };
}
