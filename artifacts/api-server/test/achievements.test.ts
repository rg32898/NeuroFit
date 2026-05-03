import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  computeAchievements,
  scoreToBand,
  type AchievementSnapshot,
} from "@workspace/shared/achievements";
import type { Domain } from "@workspace/shared/profile";

function emptyProf(): Record<Domain, number> {
  return {
    vocabulary: 0,
    writing: 0,
    reading: 0,
    speaking: 0,
    math: 0,
    memory: 0,
  };
}

function snapshot(
  overrides: Partial<AchievementSnapshot> = {},
): AchievementSnapshot {
  return {
    streak: { current: 0, longest: 0, freezesAvailable: 0 },
    proficiency: emptyProf(),
    totals: { workoutsCompleted: 0, gamesCompleted: 0 },
    dailyCompletions: [],
    ...overrides,
  };
}

describe("scoreToBand", () => {
  it("maps the 4 quartiles correctly", () => {
    expect(scoreToBand(0)).toBe("Beginner");
    expect(scoreToBand(1249)).toBe("Beginner");
    expect(scoreToBand(1250)).toBe("Intermediate");
    expect(scoreToBand(2499)).toBe("Intermediate");
    expect(scoreToBand(2500)).toBe("Advanced");
    expect(scoreToBand(3749)).toBe("Advanced");
    expect(scoreToBand(3750)).toBe("Expert");
    expect(scoreToBand(5000)).toBe("Expert");
  });
});

describe("computeAchievements", () => {
  it("returns nothing for an empty snapshot", () => {
    expect(computeAchievements(snapshot())).toEqual([]);
  });

  it("unlocks first_workout exactly when at least one workout is complete", () => {
    const off = computeAchievements(snapshot()).map((a) => a.id);
    expect(off).not.toContain("first_workout");

    const on = computeAchievements(
      snapshot({ totals: { workoutsCompleted: 1, gamesCompleted: 0 } }),
    ).map((a) => a.id);
    expect(on).toContain("first_workout");
  });

  it("workout milestones cascade (1 → first, 3 → +three, 10 → +ten)", () => {
    const ids10 = computeAchievements(
      snapshot({ totals: { workoutsCompleted: 10, gamesCompleted: 0 } }),
    ).map((a) => a.id);
    expect(ids10).toContain("first_workout");
    expect(ids10).toContain("three_workouts");
    expect(ids10).toContain("ten_workouts");

    const ids3 = computeAchievements(
      snapshot({ totals: { workoutsCompleted: 3, gamesCompleted: 0 } }),
    ).map((a) => a.id);
    expect(ids3).toContain("first_workout");
    expect(ids3).toContain("three_workouts");
    expect(ids3).not.toContain("ten_workouts");
  });

  it("hundred_games threshold is exact", () => {
    expect(
      computeAchievements(
        snapshot({ totals: { workoutsCompleted: 0, gamesCompleted: 99 } }),
      ).map((a) => a.id),
    ).not.toContain("hundred_games");
    expect(
      computeAchievements(
        snapshot({ totals: { workoutsCompleted: 0, gamesCompleted: 100 } }),
      ).map((a) => a.id),
    ).toContain("hundred_games");
  });

  it("streak achievements unlock on LONGEST (not current) streak", () => {
    const ids = computeAchievements(
      snapshot({ streak: { current: 1, longest: 30, freezesAvailable: 2 } }),
    ).map((a) => a.id);
    expect(ids).toContain("seven_day_streak");
    expect(ids).toContain("thirty_day_streak");
    expect(ids).not.toContain("hundred_day_streak");
  });

  it("per-domain advanced thresholds fire independently at 2500", () => {
    const prof = emptyProf();
    prof.vocabulary = 2500;
    prof.math = 2499;
    const ids = computeAchievements(snapshot({ proficiency: prof })).map(
      (a) => a.id,
    );
    expect(ids).toContain("vocabulary_advanced");
    expect(ids).not.toContain("math_advanced");
  });

  it("all_domains_intermediate requires every domain ≥ 1250", () => {
    const prof = emptyProf();
    for (const d of Object.keys(prof)) {
      (prof as Record<string, number>)[d] = 1250;
    }
    expect(
      computeAchievements(snapshot({ proficiency: prof })).map((a) => a.id),
    ).toContain("all_domains_intermediate");

    prof.memory = 1249;
    expect(
      computeAchievements(snapshot({ proficiency: prof })).map((a) => a.id),
    ).not.toContain("all_domains_intermediate");
  });

  it("all_domains_advanced requires every domain ≥ 2500", () => {
    const prof = emptyProf();
    for (const d of Object.keys(prof)) {
      (prof as Record<string, number>)[d] = 3000;
    }
    const ids = computeAchievements(snapshot({ proficiency: prof })).map(
      (a) => a.id,
    );
    expect(ids).toContain("all_domains_advanced");
    expect(ids).toContain("all_domains_intermediate");
  });

  it("returns achievements in catalogue order (stable for clients)", () => {
    const prof = emptyProf();
    for (const d of Object.keys(prof)) {
      (prof as Record<string, number>)[d] = 5000;
    }
    const ids = computeAchievements(
      snapshot({
        streak: { current: 200, longest: 200, freezesAvailable: 2 },
        proficiency: prof,
        totals: { workoutsCompleted: 200, gamesCompleted: 1000 },
      }),
    ).map((a) => a.id);

    const catalogueOrder = ACHIEVEMENTS.map((a) => a.id);
    const filtered = catalogueOrder.filter((id) => ids.includes(id));
    expect(ids).toEqual(filtered);
  });

  it("unlocks every achievement when snapshot is maxed", () => {
    const prof = emptyProf();
    for (const d of Object.keys(prof)) {
      (prof as Record<string, number>)[d] = 5000;
    }
    const ids = computeAchievements(
      snapshot({
        streak: { current: 200, longest: 200, freezesAvailable: 2 },
        proficiency: prof,
        totals: { workoutsCompleted: 200, gamesCompleted: 1000 },
      }),
    ).map((a) => a.id);

    expect(ids.length).toBe(ACHIEVEMENTS.length);
  });
});
