import { z } from "zod";

export const DOMAINS = [
  "vocabulary",
  "writing",
  "reading",
  "speaking",
  "math",
  "memory",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const domainSchema = z.enum(DOMAINS);

/**
 * timerScale legend:
 *  100 = 100% (full timer pressure)
 *  125 = 75%
 *  150 = 50%
 *  175 = 25%
 *  200 = off
 */
export const timerScaleSchema = z.union([
  z.literal(100),
  z.literal(125),
  z.literal(150),
  z.literal(175),
  z.literal(200),
]);

export const profileUpdateSchema = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    birthYear: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .optional(),
    focusDomain: domainSchema.optional(),
    relaxedMode: z.boolean().optional(),
    timerScale: timerScaleSchema.optional(),
  })
  .strict();

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const assessmentAnswerSchema = z.object({
  domain: domainSchema,
  correct: z.boolean().nullable(),
});

export type AssessmentAnswer = z.infer<typeof assessmentAnswerSchema>;

export const assessmentSubmissionSchema = z.object({
  answers: z.array(assessmentAnswerSchema),
});

export type AssessmentSubmission = z.infer<typeof assessmentSubmissionSchema>;

export type ProficiencyScores = Record<Domain, number>;
