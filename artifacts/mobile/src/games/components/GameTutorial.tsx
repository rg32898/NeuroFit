import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import type { GameTutorialContent } from "../types";

export type GameTutorialProps = {
  /** Game name shown above the tutorial body. */
  gameTitle: string;
  /** i18n key pair for tutorial content. */
  content: GameTutorialContent;
  /** Fires when the user taps "Got it". The container persists the flag. */
  onAcknowledged: () => void;
};

/**
 * One-screen tutorial (FR-4.8). Rendered by `GameContainer` the first
 * time a user opens a game whose definition declares `tutorial`. The
 * "Got it" button calls `onAcknowledged` which persists the flag via
 * `useTutorialSeen` so this screen never appears again on this device.
 */
export function GameTutorial({
  gameTitle,
  content,
  onAcknowledged,
}: GameTutorialProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted">
          {gameTitle}
        </Text>
        <Text variant="titleLg">{t(content.title)}</Text>
        <Text variant="body">{t(content.body)}</Text>
        <Button
          label={t("gameFramework.tutorial.gotIt")}
          fullWidth
          onPress={onAcknowledged}
          accessibilityLabel={t("gameFramework.tutorial.gotIt")}
        />
      </View>
    </Card>
  );
}
