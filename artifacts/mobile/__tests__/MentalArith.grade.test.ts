/**
 * Grade tests for the math game (Prompt 15). The spec calls out
 * "no negative-number trap": both numeric and string answers including
 * a leading minus must grade correctly.
 */
import {
  mentalArithGame,
  parseAnswer,
  type MentalArithPayload,
} from "@app/games/math/MentalArith";
import type { GameItem } from "@app/games/types";

function makeItem(payload: MentalArithPayload): GameItem<MentalArithPayload> {
  return {
    id: "item-1",
    gameId: "g-math",
    difficultyBand: 1,
    version: 1,
    payload,
  };
}

describe("parseAnswer", () => {
  it("parses positive integers", () => {
    expect(parseAnswer("42")).toBe(42);
    expect(parseAnswer(" 7 ")).toBe(7);
  });

  it("parses negative integers", () => {
    expect(parseAnswer("-5")).toBe(-5);
    expect(parseAnswer(" -100 ")).toBe(-100);
  });

  it("parses an explicit positive sign", () => {
    expect(parseAnswer("+3")).toBe(3);
  });

  it("returns NaN for empty / sign-only / junk input", () => {
    expect(Number.isNaN(parseAnswer(""))).toBe(true);
    expect(Number.isNaN(parseAnswer("   "))).toBe(true);
    expect(Number.isNaN(parseAnswer("-"))).toBe(true);
    expect(Number.isNaN(parseAnswer("12abc"))).toBe(true);
    expect(Number.isNaN(parseAnswer("3.5"))).toBe(true);
  });
});

describe("mentalArithGame.grade", () => {
  it("marks an exact numeric answer as correct", () => {
    const r = mentalArithGame.grade(
      makeItem({ expression: "3 + 4", answer: 7 }),
      7,
    );
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1000);
  });

  it("marks a wrong numeric answer as incorrect", () => {
    const r = mentalArithGame.grade(
      makeItem({ expression: "3 + 4", answer: 7 }),
      8,
    );
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });

  it("accepts a string answer that parses to the expected value", () => {
    const r = mentalArithGame.grade(
      makeItem({ expression: "3 + 4", answer: 7 }),
      "  7  ",
    );
    expect(r.correct).toBe(true);
  });

  it("handles negative answers (no negative-number trap)", () => {
    const item = makeItem({ expression: "5 - 8 - 2", answer: -5 });
    expect(mentalArithGame.grade(item, -5).correct).toBe(true);
    expect(mentalArithGame.grade(item, "-5").correct).toBe(true);
    expect(mentalArithGame.grade(item, "5").correct).toBe(false);
  });

  it("rejects junk string answers without throwing", () => {
    const item = makeItem({ expression: "3 + 4", answer: 7 });
    expect(() => mentalArithGame.grade(item, "abc")).not.toThrow();
    expect(mentalArithGame.grade(item, "abc").correct).toBe(false);
  });
});
