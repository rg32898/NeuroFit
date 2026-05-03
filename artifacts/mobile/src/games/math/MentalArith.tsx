import React, { useState } from "react";
import { TextInput, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import type { GameDefinition, GameProps } from "../types";

/**
 * Math game (FR-3.2). Renders an arithmetic expression and a numeric
 * input. Submission parses the input to an integer and grades by exact
 * equality — including negative answers, which the input field accepts
 * (the spec calls this out explicitly: "no negative-number trap").
 */

export type MentalArithPayload = {
  expression: string;
  answer: number;
};

/** Accept either a numeric or a raw-string answer (trimmed, signed). */
export type MentalArithAnswer = number | string;

/** Parse a user-typed numeric string. Returns NaN on invalid input. */
export function parseAnswer(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "+") return Number.NaN;
  // Accept leading + or -, optional digits. Reject anything else (e.g.
  // "12abc") so a junk submission doesn't silently coerce to a number.
  if (!/^[+-]?\d+$/.test(trimmed)) return Number.NaN;
  return Number.parseInt(trimmed, 10);
}

function MentalArithComponent({
  item,
  onSubmit,
  onSkip,
}: GameProps<MentalArithPayload, MentalArithAnswer>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() === "") return;
    onSubmit(value);
  };

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {t("games.mentalArith.eyebrow")}
        </Text>
        <Text variant="displayMd">{item.payload.expression} = ?</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={value}
          onChangeText={setValue}
          placeholder={t("games.mentalArith.inputPlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          // Use a numeric pad that allows the minus sign on iOS. On
          // Android the same KB also exposes "-".
          keyboardType="numbers-and-punctuation"
          inputMode="numeric"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          accessibilityLabel={t("games.mentalArith.inputPlaceholder")}
        />
        <Button
          label={t("games.common.submit")}
          fullWidth
          disabled={value.trim() === ""}
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

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    textAlign: "center",
  },
});

export const mentalArithGame: GameDefinition<
  MentalArithPayload,
  MentalArithAnswer
> = {
  slug: "mental-arith",
  title: "Mental Arithmetic",
  domain: "math",
  baseSeconds: 30,
  tutorial: {
    title: "games.mentalArith.tutorial.title",
    body: "games.mentalArith.tutorial.body",
  },
  Component: MentalArithComponent,
  grade(item, answer) {
    const expected = item.payload.answer;
    const submitted =
      typeof answer === "number" ? answer : parseAnswer(answer);
    const correct = Number.isFinite(submitted) && submitted === expected;
    return {
      correct,
      score: correct ? 1000 : 0,
      explanation: `${item.payload.expression} = ${expected}.`,
    };
  },
};
