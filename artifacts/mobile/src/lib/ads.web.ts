/**
 * Web stub for the rewarded-ads module.
 *
 * `react-native-google-mobile-ads` is a native-only module — its top-level
 * imports (e.g. `react-native/Libraries/Utilities/codegenNativeComponent`)
 * crash the Metro web bundler even when the SDK is loaded via `require()`,
 * because Metro statically resolves `require` calls during bundling.
 *
 * Metro picks `ads.web.ts` over `ads.ts` automatically when bundling for
 * web, so this file replaces the native implementation and ads simply
 * become a no-op in the browser. All public types and helpers mirror the
 * native module so import sites compile unchanged.
 */

export type AdReasonCode =
  | "unlock_premium_game"
  | "extra_freeze"
  | "manual_test";

export type AdsConfig = {
  isPremium: () => boolean;
};

export function configureAds(_next: AdsConfig): void {
  // no-op on web
}

export async function showRewardedAd(
  _reasonCode: AdReasonCode,
): Promise<boolean> {
  // No rewarded ads on the web build — the SDK is native-only.
  return false;
}

export function _resetAdsForTests(): void {
  // no-op
}

export const _MAX_REWARDS_PER_SESSION = 1;
