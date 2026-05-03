import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import type { GameDefinition, GameProps } from "../types";

/**
 * Memory game (FR-3.3). Player is shown a 4×4 grid of words for a
 * relaxed-mode-aware study window. The grid then hides; we surface a
 * single random word from the grid and ask the player to tap one of
 * the cells that originally held it. Each word appears exactly twice in
 * the grid (a "pair"), so either cell counts as correct.
 *
 * The study-time countdown lives inside this component because it is
 * game-specific UI; the framework's per-item Timer (FeedbackPanel
 * pause, expiry) wraps the whole interaction at a higher level.
 */

export type PairsRecallPayload = {
  /** 4×4 grid of words. Each unique word appears exactly twice. */
  grid: string[][];
};

/** The cell the player tapped + the word they were asked to find. */
export type PairsRecallAnswer = {
  word: string;
  row: number;
  col: number;
};

const STUDY_SECONDS_BASE = 5;
const STUDY_SECONDS_RELAXED = 8;

/** Deterministic word picker so re-renders don't shuffle the question. */
function pickQuestionWord(grid: string[][], itemId: string): string {
  const flat = grid.flat();
  const unique = Array.from(new Set(flat));
  const seed = itemId
    .split("")
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return unique[seed % unique.length] ?? flat[0] ?? "";
}

type Phase = "study" | "recall";

function PairsRecallComponent({
  item,
  onSubmit,
  onSkip,
  relaxed,
}: GameProps<PairsRecallPayload, PairsRecallAnswer>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const grid = item.payload.grid;
  const studyDuration = relaxed ? STUDY_SECONDS_RELAXED : STUDY_SECONDS_BASE;

  const [phase, setPhase] = useState<Phase>("study");
  const [remaining, setRemaining] = useState(studyDuration);

  const questionWord = useMemo(
    () => pickQuestionWord(grid, item.id),
    [grid, item.id],
  );

  // Study-phase countdown. Independent of the framework Timer so it can
  // tick while the framework Timer is also running — they measure
  // different things.
  useEffect(() => {
    if (phase !== "study") return;
    if (remaining <= 0) {
      setPhase("recall");
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, remaining]);

  const handleCellPress = (row: number, col: number) => {
    if (phase !== "recall") return;
    onSubmit({ word: questionWord, row, col });
  };

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {t("games.pairsRecall.eyebrow")}
        </Text>
        {phase === "study" ? (
          <Text variant="body">
            {t("games.pairsRecall.studyPrompt", { seconds: remaining })}
          </Text>
        ) : (
          <Text variant="body">
            {t("games.pairsRecall.recallPrompt", { word: questionWord })}
          </Text>
        )}

        <View style={styles.grid}>
          {grid.map((row, rIdx) => (
            <View key={`r-${rIdx}`} style={styles.row}>
              {row.map((cell, cIdx) => {
                const showWord = phase === "study";
                return (
                  <Pressable
                    key={`c-${rIdx}-${cIdx}`}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => handleCellPress(rIdx, cIdx)}
                    accessibilityLabel={
                      showWord
                        ? t("games.pairsRecall.cellLabelShown", {
                            row: rIdx + 1,
                            col: cIdx + 1,
                            word: cell,
                          })
                        : t("games.pairsRecall.cellLabelHidden", {
                            row: rIdx + 1,
                            col: cIdx + 1,
                          })
                    }
                    accessibilityRole="button"
                    disabled={phase !== "recall"}
                  >
                    <Text variant="body">{showWord ? cell : "?"}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

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

const styles = StyleSheet.create({
  grid: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
});

export const pairsRecallGame: GameDefinition<
  PairsRecallPayload,
  PairsRecallAnswer
> = {
  slug: "pairs-recall",
  title: "Pairs Recall",
  domain: "memory",
  baseSeconds: 30,
  tutorial: {
    title: "games.pairsRecall.tutorial.title",
    body: "games.pairsRecall.tutorial.body",
  },
  Component: PairsRecallComponent,
  grade(item, answer) {
    const { grid } = item.payload;
    const cell = grid[answer.row]?.[answer.col];
    const correct = !!cell && cell === answer.word;
    return {
      correct,
      score: correct ? 1000 : 0,
      explanation: correct
        ? `Yes — "${answer.word}" was at row ${answer.row + 1}, col ${answer.col + 1}.`
        : `That cell held "${cell ?? "?"}" — you were looking for "${answer.word}".`,
    };
  },
};
