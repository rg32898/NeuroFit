import { describe, expect, it } from "vitest";
import {
  computeAssessmentScores,
  SCORING_CONSTANTS,
} from "../src/services/assessmentService";
import { DOMAINS, type AssessmentAnswer } from "@workspace/shared/profile";

const { BASE_SCORE, MIN_SCORE, MAX_SCORE } = SCORING_CONSTANTS;

function buildAnswers(domain: (typeof DOMAINS)[number], correctness: Array<boolean | null>): AssessmentAnswer[] {
  return correctness.map((correct) => ({ domain, correct }));
}

describe("computeAssessmentScores", () => {
  it("returns one score per domain", () => {
    const result = computeAssessmentScores([]);
    expect(Object.keys(result).sort()).toEqual([...DOMAINS].sort());
  });

  it("all-skipped → BASE_SCORE for every domain", () => {
    const result = computeAssessmentScores([]);
    for (const domain of DOMAINS) {
      expect(result[domain]).toBe(BASE_SCORE);
    }
  });

  it("all-correct → MAX_SCORE (high but not the cap of 5000)", () => {
    const answers = DOMAINS.flatMap((d) =>
      buildAnswers(d, [true, true, true]),
    );
    const result = computeAssessmentScores(answers);
    for (const domain of DOMAINS) {
      expect(result[domain]).toBe(MAX_SCORE);
      expect(result[domain]).toBeLessThan(5000);
    }
  });

  it("all-wrong → MIN_SCORE (low but not zero)", () => {
    const answers = DOMAINS.flatMap((d) =>
      buildAnswers(d, [false, false, false]),
    );
    const result = computeAssessmentScores(answers);
    for (const domain of DOMAINS) {
      expect(result[domain]).toBe(MIN_SCORE);
      expect(result[domain]).toBeGreaterThan(0);
    }
  });

  it("mixed correctness lands between MIN and MAX", () => {
    const answers = buildAnswers("math", [true, false, true, false]);
    const result = computeAssessmentScores(answers);
    expect(result.math).toBeGreaterThan(MIN_SCORE);
    expect(result.math).toBeLessThan(MAX_SCORE);
    // 2/4 correct → MIN + 0.5 * (MAX - MIN) = 500 + 1750 = 2250
    expect(result.math).toBe(2250);
  });

  it("only some domains answered → unanswered ones default to BASE_SCORE", () => {
    const answers = buildAnswers("vocabulary", [true, true]);
    const result = computeAssessmentScores(answers);
    expect(result.vocabulary).toBe(MAX_SCORE);
    for (const domain of DOMAINS) {
      if (domain !== "vocabulary") {
        expect(result[domain]).toBe(BASE_SCORE);
      }
    }
  });

  it("treats null answers (skipped questions) as not counting", () => {
    const answers = buildAnswers("memory", [true, null, null]);
    const result = computeAssessmentScores(answers);
    // Only one answered, all correct → MAX
    expect(result.memory).toBe(MAX_SCORE);
  });

  it("all-null in a domain → BASE_SCORE for that domain", () => {
    const answers = buildAnswers("speaking", [null, null, null]);
    const result = computeAssessmentScores(answers);
    expect(result.speaking).toBe(BASE_SCORE);
  });

  it("scores are always within [0, 5000]", () => {
    const answers = DOMAINS.flatMap((d) =>
      buildAnswers(d, [true, false, true, null]),
    );
    const result = computeAssessmentScores(answers);
    for (const domain of DOMAINS) {
      expect(result[domain]).toBeGreaterThanOrEqual(0);
      expect(result[domain]).toBeLessThanOrEqual(5000);
    }
  });
});
