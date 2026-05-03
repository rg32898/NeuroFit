import { Platform } from "react-native";

import { isWorkoutActive } from "./workout-state";

/**
 * Rewarded ads (FR-7.x) — single API for the whole app.
 *
 *   showRewardedAd(reasonCode) → Promise<boolean>
 *
 * Returns `true` only when the user actually earned the reward
 * (watched the full ad). Returns `false` for: premium user, cap hit,
 * during workout, SDK init failure, or user dismissed early.
 *
 * Caps:
 *   - FR-7.4: max 1 successful reward per app-open session.
 *   - FR-7.5: never during an active workout.
 *   - FR-7.7: premium subscribers short-circuit BEFORE the SDK loads.
 *
 * Why dynamic import:
 *   - `react-native-google-mobile-ads` is a native module. Expo Go and
 *     jest don't have it. The dynamic require lets the bundle build
 *     and the tests run; in a real production build the module is
 *     present and we use it normally. If the import fails we degrade
 *     to "no ad available" which is the safe answer.
 */

export type AdReasonCode =
  | "unlock_premium_game"
  | "extra_freeze"
  | "manual_test";

export type AdsConfig = {
  /** Returns true when the user is currently a paying / trialing subscriber. */
  isPremium: () => boolean;
};

let config: AdsConfig = { isPremium: () => false };
let initialized = false;
let initPromise: Promise<boolean> | null = null;
let rewardedShownThisSession = 0;
let inFlightShow: Promise<boolean> | null = null;
const MAX_REWARDS_PER_SESSION = 1;

/**
 * Wire the ads module to whatever produces premium status. Called once
 * from the root layout. Idempotent.
 */
export function configureAds(next: AdsConfig): void {
  config = next;
}

function getTestUnitId(): string | null {
  // Google's official test ad units. Always safe in dev builds.
  if (Platform.OS === "android") {
    return "ca-app-pub-3940256099942544/5224354917";
  }
  if (Platform.OS === "ios") {
    return "ca-app-pub-3940256099942544/1712485313";
  }
  return null;
}

function getProdUnitId(): string | null {
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT ?? null;
  }
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT ?? null;
  }
  return null;
}

function resolveUnitId(): string | null {
  if (__DEV__) return getTestUnitId();
  return getProdUnitId() ?? getTestUnitId();
}

/**
 * Lazily resolve the SDK. Returns `null` if it isn't installed (jest /
 * Expo Go) so callers degrade gracefully.
 */
type AdMobModule = {
  default?: { initialize?: () => Promise<unknown> };
  RewardedAd?: {
    createForAdRequest: (
      unit: string,
      opts?: { requestNonPersonalizedAdsOnly?: boolean },
    ) => RewardedAdInstance;
  };
  RewardedAdEventType?: { LOADED: string; EARNED_REWARD: string };
  AdEventType?: { CLOSED: string; ERROR: string };
};

type RewardedAdInstance = {
  load: () => void;
  show: () => Promise<unknown>;
  addAdEventListener: (
    type: string,
    listener: (data?: unknown) => void,
  ) => () => void;
};

function loadSdk(): AdMobModule | null {
  try {
    // Dynamic require — must NOT be a top-level import or jest blows up
    // with "Could not find a declaration file" / native module errors.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-google-mobile-ads") as AdMobModule;
    return mod;
  } catch {
    return null;
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const sdk = loadSdk();
    if (!sdk?.default?.initialize) return false;
    try {
      await sdk.default.initialize();
      initialized = true;
      return true;
    } catch {
      return false;
    }
  })();
  const result = await initPromise;
  initPromise = null;
  return result;
}

/**
 * Public API. Resolves to `true` IFF the user actually earned the reward.
 *
 * Single-flight: concurrent callers share the same promise so two rapid
 * taps cannot both pass the cap check before the counter increments.
 */
export async function showRewardedAd(
  reasonCode: AdReasonCode,
): Promise<boolean> {
  if (inFlightShow) return inFlightShow;
  inFlightShow = (async () => {
    try {
      return await runShowRewardedAd(reasonCode);
    } finally {
      inFlightShow = null;
    }
  })();
  return inFlightShow;
}

async function runShowRewardedAd(
  _reasonCode: AdReasonCode,
): Promise<boolean> {
  // FR-7.7 — premium short-circuit BEFORE the SDK touches the network.
  if (config.isPremium()) return false;
  // FR-7.5 — never during an active workout.
  if (isWorkoutActive()) return false;
  // FR-7.4 — single reward per app-open session.
  if (rewardedShownThisSession >= MAX_REWARDS_PER_SESSION) return false;

  const ok = await ensureInitialized();
  if (!ok) return false;

  const sdk = loadSdk();
  const unitId = resolveUnitId();
  if (!sdk?.RewardedAd || !sdk.RewardedAdEventType || !sdk.AdEventType || !unitId) {
    return false;
  }

  const ad = sdk.RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  const earned = await new Promise<boolean>((resolve) => {
    let didEarn = false;
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      offLoaded();
      offEarned();
      offClosed();
      offError();
      resolve(value);
    };
    const offLoaded = ad.addAdEventListener(
      sdk.RewardedAdEventType!.LOADED,
      () => {
        // Show only after load — show() before load throws.
        ad.show().catch(() => settle(false));
      },
    );
    const offEarned = ad.addAdEventListener(
      sdk.RewardedAdEventType!.EARNED_REWARD,
      () => {
        didEarn = true;
      },
    );
    const offClosed = ad.addAdEventListener(sdk.AdEventType!.CLOSED, () => {
      settle(didEarn);
    });
    const offError = ad.addAdEventListener(sdk.AdEventType!.ERROR, () => {
      settle(false);
    });
    ad.load();
  });

  if (earned) rewardedShownThisSession++;
  return earned;
}

// ── Test helpers ────────────────────────────────────────────────────────────

export function _resetAdsForTests(): void {
  rewardedShownThisSession = 0;
  initialized = false;
  initPromise = null;
  inFlightShow = null;
  config = { isPremium: () => false };
}

export const _MAX_REWARDS_PER_SESSION = MAX_REWARDS_PER_SESSION;
