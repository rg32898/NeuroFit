import { describe, expect, it } from "vitest";
import {
  clampScore,
  decisionToDelta,
  evaluatePerformance,
  type EngineEvent,
} from "../src/services/adaptiveEngine";
import {
  PERFORMANCE_HIGH_THRESHOLD,
  PERFORMANCE_LOW_THRESHOLD,
  SCORE_ADJUSTMENT,
} from "@workspace/shared/workout";

const t0 = new Date("2026-05-01T08:00:00Z").getTime();
function ev(
  offsetMin: number,
  eventType: string,
  score: number | null,
): EngineEvent {
  return {
    eventType,
    score,
    createdAt: new Date(t0 + offsetMin * 60_000),
  };
}

describe("evaluatePerformance — RAISE", () => {
  it("two consecutive high scores → RAISE", () => {
    const events = [
      ev(0, "session_completed", 50),
      ev(10, "session_completed", 80),
      ev(20, "session_completed", 90),
    ];
    expect(evaluatePerformance(events)).toBe("RAISE");
  });

  it("scores exactly at the high threshold count as high", () => {
    const events = [
      ev(0, "session_completed", PERFORMANCE_HIGH_THRESHOLD),
      ev(10, "session_completed", PERFORMANCE_HIGH_THRESHOLD),
    ];
    expect(evaluatePerformance(events)).toBe("RAISE");
  });
});

describe("evaluatePerformance — LOWER", () => {
  it("two consecutive low scores → LOWER", () => {
    const events = [
      ev(0, "session_completed", 50),
      ev(10, "session_completed", 25),
      ev(20, "session_completed", 10),
    ];
    expect(evaluatePerformance(events)).toBe("LOWER");
  });

  it("scores exactly at the low threshold count as low", () => {
    const events = [
      ev(0, "session_completed", PERFORMANCE_LOW_THRESHOLD),
      ev(10, "session_completed", PERFORMANCE_LOW_THRESHOLD),
    ];
    expect(evaluatePerformance(events)).toBe("LOWER");
  });

  it("a too_hard signal short-circuits to LOWER even after high scores", () => {
    const events = [
      ev(0, "session_completed", 95),
      ev(10, "session_completed", 95),
      ev(20, "too_hard", null),
    ];
    expect(evaluatePerformance(events)).toBe("LOWER");
  });
});

describe("evaluatePerformance — HOLD", () => {
  it("empty events → HOLD", () => {
    expect(evaluatePerformance([])).toBe("HOLD");
  });

  it("only one scoring event → HOLD", () => {
    const events = [ev(0, "session_completed", 95)];
    expect(evaluatePerformance(events)).toBe("HOLD");
  });

  it("mixed high+low → HOLD (no two-in-a-row in either direction)", () => {
    const events = [
      ev(0, "session_completed", 90),
      ev(10, "session_completed", 20),
      ev(20, "session_completed", 90),
    ];
    expect(evaluatePerformance(events)).toBe("HOLD");
  });

  it("middle scores → HOLD (Elevate L-8 protection)", () => {
    const events = [
      ev(0, "session_completed", 50),
      ev(10, "session_completed", 55),
    ];
    expect(evaluatePerformance(events)).toBe("HOLD");
  });

  it("never RAISES after a poor performance (regression for FR L-8)", () => {
    // High score followed by poor performance must not RAISE.
    const events = [
      ev(0, "session_completed", 95),
      ev(10, "session_completed", 15),
    ];
    expect(evaluatePerformance(events)).not.toBe("RAISE");
  });

  it("ignores item_served events (no score)", () => {
    const events = [
      ev(0, "item_served", null),
      ev(10, "item_served", null),
      ev(20, "session_completed", 90),
    ];
    // Only one scoring event — HOLD
    expect(evaluatePerformance(events)).toBe("HOLD");
  });
});

describe("evaluatePerformance — ordering", () => {
  it("respects createdAt order regardless of input order", () => {
    const events = [
      ev(20, "session_completed", 10), // newest, low
      ev(0, "session_completed", 95),  // oldest, high
      ev(10, "session_completed", 5),  // middle, low
    ];
    // Sorted: [95, 5, 10]; last two are 5 and 10 → both ≤ 30 → LOWER
    expect(evaluatePerformance(events)).toBe("LOWER");
  });
});

describe("decisionToDelta", () => {
  it("RAISE → +SCORE_ADJUSTMENT", () => {
    expect(decisionToDelta("RAISE")).toBe(SCORE_ADJUSTMENT);
  });
  it("LOWER → -SCORE_ADJUSTMENT", () => {
    expect(decisionToDelta("LOWER")).toBe(-SCORE_ADJUSTMENT);
  });
  it("HOLD → 0", () => {
    expect(decisionToDelta("HOLD")).toBe(0);
  });
});

describe("clampScore", () => {
  it("clamps to [0, 5000]", () => {
    expect(clampScore(-100)).toBe(0);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(2500)).toBe(2500);
    expect(clampScore(5000)).toBe(5000);
    expect(clampScore(99999)).toBe(5000);
  });
});
