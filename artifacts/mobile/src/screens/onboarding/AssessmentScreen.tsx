import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { AssessmentAnswer, Domain } from "@workspace/shared/profile";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

/**
 * Domains chosen for the initial assessment. Per the prompt: "5 short
 * questions, one per non-memory domain" — `memory` is excluded because
 * it's the daily-challenge domain and is calibrated separately.
 */
const ASSESSMENT_DOMAINS: ReadonlyArray<Domain> = [
  "vocabulary",
  "writing",
  "reading",
  "speaking",
  "math",
];

export type AssessmentScreenProps = {
  /** Called when the user submits all answers. Must persist server-side. */
  onSubmit: (answers: AssessmentAnswer[]) => Promise<void> | void;
  /** Called when the user taps "Skip for now" at any point. */
  onSkip: () => void;
};

/**
 * Five quick self-rated questions used to seed proficiency scores. Each
 * question is a single binary choice — "Yes I'm comfortable" / "Not yet"
 * — mapped to `correct: true | false`. The user can skip the *whole*
 * assessment at any step (FR-1.3) — that's the "Skip for now" button,
 * which is always visible per spec.
 *
 * The screen is a pure component: it owns local progress state and
 * delegates the actual API call to `onSubmit`. This keeps it trivial to
 * test in RNTL without needing the router or auth store.
 */
export function AssessmentScreen({
  onSubmit,
  onSkip,
}: AssessmentScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = ASSESSMENT_DOMAINS.length;
  const currentDomain = ASSESSMENT_DOMAINS[index];

  const questionKey = useMemo(
    () => `onboarding.assessment.questions.${currentDomain}`,
    [currentDomain],
  );

  async function record(correct: boolean) {
    if (!currentDomain) return;
    const next: AssessmentAnswer[] = [
      ...answers,
      { domain: currentDomain, correct },
    ];
    setAnswers(next);

    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }

    // Last question — submit.
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(next);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t("common.error");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: theme.spacing.lg }}>
        <Text variant="caption" tone="muted">
          {t("onboarding.assessment.progress", {
            current: index + 1,
            total,
          })}
        </Text>
        <Text variant="displayMd">{t("onboarding.assessment.title")}</Text>
        <Text variant="body" tone="muted">
          {t("onboarding.assessment.subtitle")}
        </Text>
      </View>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="titleMd">{t(questionKey)}</Text>

          <View style={{ gap: theme.spacing.md }}>
            <Button
              label={t("onboarding.assessment.yes")}
              fullWidth
              loading={submitting}
              disabled={submitting}
              onPress={() => void record(true)}
            />
            <Button
              label={t("onboarding.assessment.no")}
              variant="secondary"
              fullWidth
              loading={submitting}
              disabled={submitting}
              onPress={() => void record(false)}
            />
          </View>

          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Skip is ALWAYS visible per FR-1.3. Even mid-question. */}
      <Button
        label={t("onboarding.assessment.skip")}
        variant="ghost"
        fullWidth
        onPress={onSkip}
        disabled={submitting}
        accessibilityLabel={t("onboarding.assessment.skip")}
      />
    </Screen>
  );
}

export { ASSESSMENT_DOMAINS };
