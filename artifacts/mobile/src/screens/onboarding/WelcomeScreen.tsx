import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type WelcomeScreenProps = {
  /** Primary CTA — guest path. Should ensure a guest id and route to assessment. */
  onTryWorkout: () => void;
  /** Secondary CTA — returning user path. Routes to login. */
  onSignIn: () => void;
};

/**
 * Onboarding entry point. Per FR-1.1, the primary CTA is the no-account
 * path so users can start a workout in <60s without friction. Sign-in is
 * the secondary path. Critically, this screen NEVER shows pricing or a
 * paywall — that's deferred until after session 3 (FR-1.5).
 */
export function WelcomeScreen({ onTryWorkout, onSignIn }: WelcomeScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          gap: theme.spacing.xxl,
        }}
      >
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="displayLg">{t("common.appName")}</Text>
          <Text variant="titleLg" tone="muted">
            {t("onboarding.welcome.title")}
          </Text>
          <Text variant="body" tone="muted">
            {t("onboarding.welcome.subtitle")}
          </Text>
        </View>

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label={t("onboarding.welcome.tryWorkout")}
              fullWidth
              onPress={onTryWorkout}
              accessibilityLabel={t("onboarding.welcome.tryWorkout")}
            />
            <Button
              label={t("onboarding.welcome.haveAccount")}
              variant="secondary"
              fullWidth
              onPress={onSignIn}
              accessibilityLabel={t("onboarding.welcome.haveAccount")}
            />
          </View>
        </Card>

        <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
          {t("onboarding.welcome.noPaymentNote")}
        </Text>
      </View>
    </Screen>
  );
}
