/**
 * FR-7.4 — rewarded-ad cap returns false on the second attempt.
 * FR-7.5 — never shows during a workout.
 * FR-7.7 — premium subscribers short-circuit before the SDK initialises.
 */

import {
  _resetAdsForTests,
  configureAds,
  showRewardedAd,
} from "../src/lib/ads";
import { setWorkoutActive } from "../src/lib/workout-state";

beforeEach(() => {
  _resetAdsForTests();
  setWorkoutActive(false);
});

describe("showRewardedAd", () => {
  it("returns true on the first attempt, false on the second (cap = 1/session)", async () => {
    const first = await showRewardedAd("manual_test");
    expect(first).toBe(true);

    const second = await showRewardedAd("manual_test");
    expect(second).toBe(false);
  });

  it("returns false during an active workout (FR-7.5)", async () => {
    setWorkoutActive(true);
    const result = await showRewardedAd("manual_test");
    expect(result).toBe(false);
  });

  it("returns false for premium users without initialising the SDK (FR-7.7)", async () => {
    const sdk = jest.requireMock("react-native-google-mobile-ads") as {
      default: { initialize: jest.Mock };
    };
    sdk.default.initialize.mockClear();

    configureAds({ isPremium: () => true });
    const result = await showRewardedAd("manual_test");

    expect(result).toBe(false);
    expect(sdk.default.initialize).not.toHaveBeenCalled();
  });
});
