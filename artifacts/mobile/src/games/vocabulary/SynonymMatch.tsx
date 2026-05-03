import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import type { GameDefinition, GameProps } from "../types";

/**
 * Vocabulary game (FR-3.1). The player is shown a target word and a
 * fixed list of options; they pick the synonym. Grading is by INDEX
 * because the seed payload encodes the answer that way — the same
 * payload travels to the client unchanged so the renderer can show
 * options in the seeded order.
 *
 * Item content (target word + options + answer) ALWAYS comes from the
 * `/api/games/:slug/items` endpoint. The mobile app holds zero word
 * lists itself.
 */

export type SynonymPayload = {
  word: string;
  options: string[];
  answer: number;
};

/**
 * The grade function tolerates two answer shapes:
 *   - `number`  → the index the user tapped (the normal flow)
 *   - `string`  → the option's text, normalised by trim+lower-case so
 *                 whitespace/casing differences never count against the
 *                 user. Useful for keyboard-driven UIs and for tests.
 */
export type SynonymAnswer = number | string;

function normalise(s: string): string {
  return s.trim().toLowerCase();
}

function SynonymMatchComponent({
  item,
  onSubmit,
  onSkip,
}: GameProps<SynonymPayload, SynonymAnswer>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { word, options } = item.payload;

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {t("games.synonymMatch.eyebrow")}
        </Text>
        <Text variant="displayMd">{word}</Text>
        <View style={{ gap: theme.spacing.sm }}>
          {options.map((opt, i) => (
            <Button
              key={`${i}-${opt}`}
              label={opt}
              variant="secondary"
              fullWidth
              onPress={() => onSubmit(i)}
              accessibilityLabel={t("games.synonymMatch.choiceLabel", {
                value: opt,
              })}
            />
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

export const synonymMatchGame: GameDefinition<SynonymPayload, SynonymAnswer> = {
  slug: "synonym-match",
  title: "Synonym Match",
  domain: "vocabulary",
  baseSeconds: 20,
  tutorial: {
    title: "games.synonymMatch.tutorial.title",
    body: "games.synonymMatch.tutorial.body",
  },
  Component: SynonymMatchComponent,
  grade(item, answer) {
    const { options, answer: correctIdx, word } = item.payload;
    const correctText = options[correctIdx] ?? "";
    let isCorrect = false;
    if (typeof answer === "number") {
      isCorrect = answer === correctIdx;
    } else if (typeof answer === "string") {
      isCorrect = normalise(answer) === normalise(correctText);
    }
    return {
      correct: isCorrect,
      score: isCorrect ? 1000 : 0,
      explanation: `"${word}" → "${correctText}".`,
    };
  },
};
