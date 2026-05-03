/**
 * Grade tests for the reading game (Prompt 15). The grade function
 * returns `correct: true` iff ALL questions are right, but `score` is
 * prorated 0..1000 by correct fraction so the proficiency engine can
 * still tell "got 1 of 2" from "got 0 of 2".
 */
import { detailGame, type DetailPayload } from "@app/games/reading/Detail";
import type { GameItem } from "@app/games/types";

function makeItem(payload: DetailPayload): GameItem<DetailPayload> {
  return {
    id: "item-1",
    gameId: "g-read",
    difficultyBand: 1,
    version: 1,
    payload,
  };
}

const item = makeItem({
  passage: "Otters crack open shells using small stones they keep under their arm.",
  questions: [
    {
      q: "What do otters do with stones?",
      options: ["Throw them", "Crack shells", "Build dams", "Sharpen teeth"],
      answer: 1,
    },
    {
      q: "Where do otters keep their stones?",
      options: ["In a burrow", "Under their arm", "In their mouth", "On a rock"],
      answer: 1,
    },
  ],
});

describe("detailGame.grade", () => {
  it("scores 1000 and correct=true when all answers right", () => {
    const r = detailGame.grade(item, [1, 1]);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1000);
  });

  it("gives partial credit (500) when 1 of 2 right but correct=false", () => {
    const r = detailGame.grade(item, [1, 0]);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(500);
  });

  it("scores 0 when no answers right", () => {
    const r = detailGame.grade(item, [0, 0]);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });

  it("treats wrong-length answers as a 0", () => {
    const r = detailGame.grade(item, [1]);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });

  it("never throws on a non-array answer", () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detailGame.grade(item, "garbage" as any),
    ).not.toThrow();
  });
});
