import { describe, expect, it } from "vitest";
import type { GameItem } from "@workspace/db";
import {
  FREE_ROTATION_FRACTION,
  getISOWeekKey,
  isGameFreeForUser,
  scoreToBand,
  selectItemsForUser,
} from "../src/services/catalogueService";

function makeItem(id: string, band: number): GameItem {
  return {
    id,
    gameId: "g1",
    payload: { foo: "bar" },
    difficultyBand: band,
    version: 1,
    reviewedById: null,
    reviewedAt: null,
    isPublished: true,
    createdAt: new Date(),
  };
}

describe("scoreToBand", () => {
  it("maps score ranges to bands 1-5", () => {
    expect(scoreToBand(0)).toBe(1);
    expect(scoreToBand(500)).toBe(1);
    expect(scoreToBand(999)).toBe(1);
    expect(scoreToBand(1000)).toBe(2);
    expect(scoreToBand(2000)).toBe(3);
    expect(scoreToBand(3000)).toBe(4);
    expect(scoreToBand(4000)).toBe(5);
    expect(scoreToBand(5000)).toBe(5);
  });

  it("clamps out-of-range scores", () => {
    expect(scoreToBand(-100)).toBe(1);
    expect(scoreToBand(99999)).toBe(5);
  });
});

describe("getISOWeekKey", () => {
  it("returns YYYY-Www format", () => {
    expect(getISOWeekKey(new Date("2026-01-05T00:00:00Z"))).toBe("2026-W02");
    expect(getISOWeekKey(new Date("2026-05-02T00:00:00Z"))).toMatch(
      /^2026-W\d{2}$/,
    );
  });

  it("is stable across times within the same UTC day", () => {
    const morning = new Date("2026-05-02T01:00:00Z");
    const evening = new Date("2026-05-02T23:00:00Z");
    expect(getISOWeekKey(morning)).toBe(getISOWeekKey(evening));
  });
});

describe("isGameFreeForUser", () => {
  const today = new Date("2026-05-02T12:00:00Z");

  it("permanently-free games are always free", () => {
    expect(
      isGameFreeForUser(
        "u1",
        { id: "free-game", isFreeTier: true },
        today,
      ),
    ).toBe(true);
  });

  it("same input → same output (deterministic)", () => {
    const game = { id: "paid-game-x", isFreeTier: false };
    const a = isGameFreeForUser("u1", game, today);
    const b = isGameFreeForUser("u1", game, today);
    const c = isGameFreeForUser("different-user", game, today);
    expect(a).toBe(b);
    expect(a).toBe(c); // user does not affect rotation
  });

  it("rotates across weeks", () => {
    // Across many games, the proportion free this week should be
    // roughly FREE_ROTATION_FRACTION.
    const games = Array.from({ length: 200 }, (_, i) => ({
      id: `paid-game-${i}`,
      isFreeTier: false,
    }));
    const free = games.filter((g) => isGameFreeForUser("u1", g, today)).length;
    const ratio = free / games.length;
    expect(ratio).toBeGreaterThan(FREE_ROTATION_FRACTION - 0.1);
    expect(ratio).toBeLessThan(FREE_ROTATION_FRACTION + 0.1);
  });

  it("the same game is free in some weeks and paid in others", () => {
    const game = { id: "paid-game-rotates", isFreeTier: false };
    const results = new Set<boolean>();
    for (let week = 0; week < 52; week++) {
      const date = new Date(2026, 0, 1 + week * 7);
      results.add(isGameFreeForUser("u1", game, date));
    }
    expect(results.size).toBe(2); // both true and false appear
  });
});

describe("selectItemsForUser", () => {
  const items: GameItem[] = [
    makeItem("a", 1),
    makeItem("b", 2),
    makeItem("c", 3),
    makeItem("d", 4),
    makeItem("e", 5),
    makeItem("f", 3),
    makeItem("g", 3),
  ];

  it("keeps items within ±1 band of the user's band", () => {
    const result = selectItemsForUser(items, 2500, new Set(), 10);
    // user score 2500 → band 3, allowed [2,3,4]
    const bands = result.map((i) => i.difficultyBand).sort();
    expect(bands).toEqual([2, 3, 3, 3, 4]);
  });

  it("clamps band range at the bottom", () => {
    const result = selectItemsForUser(items, 100, new Set(), 10);
    // band 1, allowed [1, 2] (no band 0)
    const bands = result.map((i) => i.difficultyBand);
    for (const b of bands) {
      expect([1, 2]).toContain(b);
    }
  });

  it("clamps band range at the top", () => {
    const result = selectItemsForUser(items, 4900, new Set(), 10);
    // band 5, allowed [4, 5]
    const bands = result.map((i) => i.difficultyBand);
    for (const b of bands) {
      expect([4, 5]).toContain(b);
    }
  });

  it("excludes items in the recent set", () => {
    const result = selectItemsForUser(
      items,
      2500,
      new Set(["c", "f"]),
      10,
    );
    const ids = result.map((i) => i.id);
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("f");
  });

  it("respects the count limit", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      makeItem(`item-${i}`, 3),
    );
    const result = selectItemsForUser(many, 2500, new Set(), 10);
    expect(result).toHaveLength(10);
  });

  it("two consecutive selections are non-overlapping when first batch is excluded", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeItem(`item-${String(i).padStart(2, "0")}`, 3),
    );
    const first = selectItemsForUser(many, 2500, new Set(), 10);
    const firstIds = new Set(first.map((i) => i.id));
    const second = selectItemsForUser(many, 2500, firstIds, 10);
    for (const item of second) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });
});
