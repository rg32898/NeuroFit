import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import type { GameDefinition, GameProps } from "../types";

/**
 * Reading game (FR-3.4). Inline passage followed by N comprehension
 * questions (typically 2 from the seed). Grading is correct-iff-all-
 * correct; partial credit is reflected in the per-item `score`
 * (0..1000 prorated by correct fraction) so the proficiency engine can
 * still differentiate "1 out of 2" from "0 out of 2".
 */

export type DetailQuestion = {
  q: string;
  options: string[];
  answer: number;
};

export type DetailPayload = {
  passage: string;
  questions: DetailQuestion[];
};

/** Selected option index per question (length must match questions[]). */
export type DetailAnswer = number[];

function DetailComponent({
  item,
  onSubmit,
  onSkip,
}: GameProps<DetailPayload, DetailAnswer>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { passage, questions } = item.payload;

  const [selected, setSelected] = useState<Array<number | undefined>>(
    () => questions.map(() => undefined),
  );

  const allAnswered = selected.every((s) => typeof s === "number");

  const handleSubmit = () => {
    if (!allAnswered) return;
    onSubmit(selected as number[]);
  };

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {t("games.detail.eyebrow")}
        </Text>
        <ScrollView style={{ maxHeight: 220 }}>
          <Text variant="body">{passage}</Text>
        </ScrollView>

        {questions.map((q, qIdx) => (
          <View key={`q-${qIdx}`} style={{ gap: theme.spacing.sm }}>
            <Text variant="titleMd">
              {qIdx + 1}. {q.q}
            </Text>
            <View style={{ gap: theme.spacing.xs }}>
              {q.options.map((opt, oIdx) => {
                const isSelected = selected[qIdx] === oIdx;
                return (
                  <Button
                    key={`q-${qIdx}-o-${oIdx}`}
                    label={opt}
                    variant={isSelected ? "primary" : "secondary"}
                    fullWidth
                    onPress={() =>
                      setSelected((prev) => {
                        const next = [...prev];
                        next[qIdx] = oIdx;
                        return next;
                      })
                    }
                    accessibilityLabel={t("games.detail.choiceLabel", {
                      question: qIdx + 1,
                      value: opt,
                    })}
                    accessibilityState={{ selected: isSelected }}
                  />
                );
              })}
            </View>
          </View>
        ))}

        <Button
          label={t("games.common.submit")}
          fullWidth
          disabled={!allAnswered}
          onPress={handleSubmit}
          accessibilityLabel={t("games.common.submit")}
        />
        <Button
          label={t("games.common.skip")}
          variant="ghost"
          fullWidth
          onPress={onSkip}
          accessibilityLabel={t("games.common.skip")}
        />
      </View>
    </Card>
  );
}

export const detailGame: GameDefinition<DetailPayload, DetailAnswer> = {
  slug: "reading-detail",
  title: "Reading Detail",
  domain: "reading",
  baseSeconds: 60,
  tutorial: {
    title: "games.detail.tutorial.title",
    body: "games.detail.tutorial.body",
  },
  Component: DetailComponent,
  grade(item, answer) {
    const { questions } = item.payload;
    if (!Array.isArray(answer) || answer.length !== questions.length) {
      return {
        correct: false,
        score: 0,
        explanation: "No answer recorded.",
      };
    }
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answer[i] === questions[i]!.answer) correctCount++;
    }
    const allCorrect = correctCount === questions.length;
    const score = Math.round((correctCount / questions.length) * 1000);
    const explanationLines = questions.map((q, i) => {
      const ok = answer[i] === q.answer;
      return `${i + 1}. ${ok ? "✓" : "✗"} ${q.options[q.answer]}`;
    });
    return {
      correct: allCorrect,
      score,
      explanation: explanationLines.join("\n"),
    };
  },
};
