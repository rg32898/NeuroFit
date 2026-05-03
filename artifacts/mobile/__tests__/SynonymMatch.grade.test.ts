/**
 * Grade tests for the vocabulary game (Prompt 15). Covers correct/wrong
 * indices, the string-answer fallback (typed answers), and the spec's
 * called-out edge cases: leading/trailing whitespace and capitalisation.
 */
import {
  synonymMatchGame,
  type SynonymPayload,
} from "@app/games/vocabulary/SynonymMatch";
import type { GameItem } from "@app/games/types";

function makeItem(payload: SynonymPayload): GameItem<SynonymPayload> {
  return {
    id: "item-1",
    gameId: "g-syn",
    difficultyBand: 1,
    version: 1,
    payload,
  };
}

const item = makeItem({
  word: "begin",
  options: ["end", "stop", "Start", "pause"],
  answer: 2,
});

describe("synonymMatchGame.grade", () => {
  it("marks the correct index as correct (1000)", () => {
    const r = synonymMatchGame.grade(item, 2);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1000);
  });

  it("marks an incorrect index as incorrect (0)", () => {
    const r = synonymMatchGame.grade(item, 0);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });

  it("accepts a string answer that matches case-insensitively", () => {
    const r = synonymMatchGame.grade(item, "start");
    expect(r.correct).toBe(true);
  });

  it("ignores leading/trailing whitespace in string answers", () => {
    const r = synonymMatchGame.grade(item, "   Start   ");
    expect(r.correct).toBe(true);
  });

  it("rejects a string answer that doesn't match the correct option", () => {
    const r = synonymMatchGame.grade(item, "stop");
    expect(r.correct).toBe(false);
  });

  it("never throws on out-of-range indices", () => {
    expect(() => synonymMatchGame.grade(item, 99)).not.toThrow();
    const r = synonymMatchGame.grade(item, 99);
    expect(r.correct).toBe(false);
  });
});
