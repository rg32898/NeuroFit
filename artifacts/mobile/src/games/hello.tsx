import React, { useMemo } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../components/ui";
import { useTheme } from "../theme";
import type { GameDefinition, GameProps } from "./types";

/**
 * Reference "hello world" game implemented entirely against the public
 * framework contract — `Component` + `grade`, no extra plumbing. Acts as
 * the worked example referenced by the prompt.
 *
 * Mechanics: show "a + b = ?", four deterministic multiple-choice
 * options, one of which is the correct sum. Tapping a choice submits;
 * Skip aborts the item.
 */

export type HelloPayload = { a: number; b: number };
export type HelloAnswer = number;

function HelloComponent({
  item,
  onSubmit,
  onSkip,
}: GameProps<HelloPayload, HelloAnswer>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { a, b } = item.payload;
  const correct = a + b;

  // Deterministic distractors keyed off the item id so re-renders stay
  // stable AND a given item shows the same options to every user.
  const choices = useMemo(() => {
    const seed = item.id
      .split("")
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const out = new Set<number>([correct]);
    let n = 1;
    while (out.size < 4 && n < 50) {
      const offset = ((seed + n * 13) % 11) - 5;
      const candidate = correct + offset;
      if (candidate >= 0 && candidate !== correct) out.add(candidate);
      n++;
    }
    // Shuffle by seed for a stable ordering that is NOT "correct first".
    return [...out].sort((x, y) => ((x * 31) % 7) - ((y * 31) % 7));
  }, [correct, item.id]);

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {t("games.hello.eyebrow")}
        </Text>
        <Text variant="displayMd">
          {a} + {b} = ?
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          {choices.map((c) => (
            <Button
              key={c}
              label={String(c)}
              variant="secondary"
              fullWidth
              onPress={() => onSubmit(c)}
              accessibilityLabel={t("games.hello.choiceLabel", { value: c })}
            />
          ))}
        </View>
        <Button
          label={t("games.hello.skip")}
          variant="ghost"
          fullWidth
          onPress={onSkip}
          accessibilityLabel={t("games.hello.skip")}
        />
      </View>
    </Card>
  );
}

export const helloGame: GameDefinition<HelloPayload, HelloAnswer> = {
  slug: "hello",
  title: "Hello World",
  domain: "math",
  baseSeconds: 15,
  Component: HelloComponent,
  grade(item, answer) {
    const expected = item.payload.a + item.payload.b;
    const correct = answer === expected;
    return {
      correct,
      score: correct ? 1000 : 0,
      explanation: `${item.payload.a} + ${item.payload.b} = ${expected}.`,
    };
  },
};
