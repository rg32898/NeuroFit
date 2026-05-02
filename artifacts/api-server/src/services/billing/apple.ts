import type { ValidatedReceipt } from "@workspace/shared/subscription";
import { planFromProductId } from "@workspace/shared/subscription";
import { config } from "../../config";

const PROD_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

/**
 * Apple App Store /verifyReceipt response shape (subset we care about).
 * Full reference: https://developer.apple.com/documentation/appstorereceipts/verifyreceipt
 */
type AppleVerifyResponse = {
  status: number;
  environment?: "Production" | "Sandbox";
  latest_receipt_info?: AppleTransaction[];
  pending_renewal_info?: AppleRenewalInfo[];
};

type AppleTransaction = {
  product_id: string;
  original_transaction_id: string;
  transaction_id: string;
  expires_date_ms?: string;
  is_trial_period?: string;
  cancellation_date_ms?: string;
};

type AppleRenewalInfo = {
  product_id: string;
  auto_renew_status: string;
  expiration_intent?: string;
};

async function postVerify(
  url: string,
  receipt: string,
): Promise<AppleVerifyResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receipt,
      password: config.APPLE_SHARED_SECRET,
      "exclude-old-transactions": true,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Apple /verifyReceipt HTTP ${res.status}: ${await res.text()}`,
    );
  }
  return (await res.json()) as AppleVerifyResponse;
}

/**
 * Verify an App Store receipt and translate the response into the unified
 * ValidatedReceipt shape.
 *
 * Apple's documented retry dance:
 *   - status 21007 → this is a sandbox receipt sent to prod, retry sandbox.
 *   - status 21008 → prod receipt sent to sandbox, retry prod.
 * We always start with prod so production traffic never leaks to sandbox.
 */
export async function verifyAppleReceipt(
  receipt: string,
): Promise<ValidatedReceipt> {
  if (!config.APPLE_SHARED_SECRET) {
    throw new Error("APPLE_SHARED_SECRET is not configured");
  }

  // Always start with prod so production traffic never leaks to sandbox.
  // 21007 (sandbox-receipt-sent-to-prod) is the only retry case we can
  // legitimately hit from this entry point — 21008 only happens when you
  // start at the sandbox URL, which we never do.
  let response = await postVerify(PROD_URL, receipt);
  if (response.status === 21007) {
    response = await postVerify(SANDBOX_URL, receipt);
  }

  if (response.status !== 0) {
    throw new Error(`Apple receipt invalid (status ${response.status})`);
  }

  const transactions = response.latest_receipt_info ?? [];
  if (transactions.length === 0) {
    throw new Error("Apple receipt has no transactions");
  }

  // Latest transaction wins.
  const latest = transactions.reduce<AppleTransaction>((best, t) => {
    const bestExp = Number(best.expires_date_ms ?? 0);
    const tExp = Number(t.expires_date_ms ?? 0);
    return tExp > bestExp ? t : best;
  }, transactions[0]!);

  const plan = planFromProductId(latest.product_id);
  if (!plan || plan === "free") {
    throw new Error(`Unknown Apple productId: ${latest.product_id}`);
  }

  const expiresAt = latest.expires_date_ms
    ? new Date(Number(latest.expires_date_ms))
    : null;
  if (!expiresAt) {
    throw new Error("Apple receipt missing expires_date_ms");
  }

  const isTrial = latest.is_trial_period === "true";
  const isCanceled = !!latest.cancellation_date_ms;
  const renewal = response.pending_renewal_info?.find(
    (r) => r.product_id === latest.product_id,
  );
  const cancelAtPeriodEnd = renewal?.auto_renew_status === "0";

  let status: ValidatedReceipt["status"];
  if (isCanceled) status = "canceled";
  else if (expiresAt.getTime() <= Date.now()) status = "expired";
  else if (isTrial) status = "trialing";
  else status = "active";

  return {
    provider: "apple",
    status,
    plan,
    providerSubscriptionId: latest.original_transaction_id,
    currentPeriodEnd: expiresAt,
    trialEndsAt: isTrial ? expiresAt : null,
    cancelAtPeriodEnd,
  };
}
