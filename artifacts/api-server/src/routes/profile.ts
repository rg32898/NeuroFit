import { Router, Request, Response } from "express";
import {
  assessmentSubmissionSchema,
  profileUpdateSchema,
} from "@workspace/shared/profile";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getProficiencyScores,
  getProfileByUserId,
  upsertProficiencyScores,
  upsertProfile,
} from "../profile/profileRepo";
import { computeAssessmentScores } from "../services/assessmentService";

const router = Router();

function reqId(req: Request): string | null {
  return (req as Request & { id?: string }).id ?? null;
}

function validationError(
  res: Response,
  message: string,
  requestId: string | null,
) {
  return res
    .status(400)
    .json({ error: { code: "VALIDATION_ERROR", message, requestId } });
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const profile = await getProfileByUserId(req.user!.id);
  const scores = await getProficiencyScores(req.user!.id);
  res.json({ profile, proficiencyScores: scores });
});

router.patch("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(
      res,
      parsed.error.errors[0]?.message ?? "Invalid profile update",
      reqId(req),
    );
    return;
  }

  const profile = await upsertProfile(req.user!.id, parsed.data);
  res.json({ profile });
});

router.post("/assessment", requireAuth, async (req: Request, res: Response) => {
  const parsed = assessmentSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(
      res,
      parsed.error.errors[0]?.message ?? "Invalid assessment submission",
      reqId(req),
    );
    return;
  }

  const scores = computeAssessmentScores(parsed.data.answers);
  const inserted = await upsertProficiencyScores(req.user!.id, scores);

  res.status(201).json({
    proficiencyScores: inserted,
  });
});

export default router;
