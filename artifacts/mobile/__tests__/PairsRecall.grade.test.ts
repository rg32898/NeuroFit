/**
 * Grade tests for the memory game (Prompt 15). Each unique word in the
 * grid appears exactly twice, so EITHER cell counts as a correct recall.
 */
import {
  pairsRecallGame,
  type PairsRecallPayload,
} from "@app/games/memory/PairsRecall";
import type { GameItem } from "@app/games/types";

function makeItem(payload: PairsRecallPayload): GameItem<PairsRecallPayload> {
  return {
    id: "item-1",
    gameId: "g-mem",
    difficultyBand: 1,
    version: 1,
    payload,
  };
}

const grid: string[][] = [
  ["sun", "moon", "star", "cloud"],
  ["rain", "snow", "wind", "leaf"],
  ["sun", "moon", "star", "cloud"], // pairs of row 0
  ["rain", "snow", "wind", "leaf"], // pairs of row 1
];
const item = makeItem({ grid });

describe("pairsRecallGame.grade", () => {
  it("marks tapping the original cell of the queried word correct", () => {
    const r = pairsRecallGame.grade(item, { word: "moon", row: 0, col: 1 });
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1000);
  });

  it("marks tapping the OTHER occurrence (the pair) correct too", () => {
    const r = pairsRecallGame.grade(item, { word: "moon", row: 2, col: 1 });
    expect(r.correct).toBe(true);
  });

  it("marks tapping a cell with the wrong word as incorrect", () => {
    const r = pairsRecallGame.grade(item, { word: "moon", row: 0, col: 0 });
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });

  it("treats out-of-range coordinates as incorrect, not as a crash", () => {
    expect(() =>
      pairsRecallGame.grade(item, { word: "moon", row: 99, col: 99 }),
    ).not.toThrow();
    const r = pairsRecallGame.grade(item, {
      word: "moon",
      row: 99,
      col: 99,
    });
    expect(r.correct).toBe(false);
  });

  it("is case-sensitive (the seed is the source of truth)", () => {
    // "Moon" with capital M is NOT in the grid — should be wrong even at
    // a valid position.
    const r = pairsRecallGame.grade(item, { word: "Moon", row: 0, col: 1 });
    expect(r.correct).toBe(false);
  });
});
