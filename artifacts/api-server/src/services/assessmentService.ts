import {
  type AssessmentAnswer,
  type Domain,
  DOMAINS,
  type ProficiencyScores,
} from "@workspace/shared/profile";

/**
 * Assessment scoring constants. Scores live in [0, 5000].
 * We bound the initial assessment to [500, 4000] so:
 *  - all-wrong gives a positive but small score (room to fall)
 *  - all-correct still leaves room to grow toward 5000
 *  - skipping yields a middling default (BASE)
 */
const BASE_SCORE = 2000;
const MIN_SCORE = 500;
const MAX_SCORE = 4000;

function computeDomainScore(answers: ReadonlyArray<AssessmentAnswer>): number {
  const answered = answers.filter((a) => a.correct !== null);
  if (answered.length === 0) return BASE_SCORE;

  const correctCount = answered.filter((a) => a.correct === true).length;
  const ratio = correctCount / answered.length;
  return Math.round(MIN_SCORE + ratio * (MAX_SCORE - MIN_SCORE));
}

/**
 * Pure function. Given the user's assessment answers, returns one starting
 * proficiency score per domain in the range [0, 5000].
 *
 * - Domains with no answers fall back to BASE_SCORE (2000).
 * - All-correct in a domain yields MAX_SCORE (4000).
 * - All-wrong yields MIN_SCORE (500).
 */
export function computeAssessmentScores(
  answers: ReadonlyArray<AssessmentAnswer>,
): ProficiencyScores {
  const result = {} as ProficiencyScores;
  for (const domain of DOMAINS) {
    const domainAnswers = answers.filter((a) => a.domain === domain);
    result[domain] = computeDomainScore(domainAnswers);
  }
  return result;
}

export const SCORING_CONSTANTS = {
  BASE_SCORE,
  MIN_SCORE,
  MAX_SCORE,
} as const;

export type { Domain };
