import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Card, Screen, Text } from "../components/ui";
import { useTheme } from "../theme";

/**
 * Pre-auth landing. Shown when the auth store has no session. Two CTAs
 * (Sign in / Create account) — no logic here yet, the wiring lands when
 * the auth screens are built in a later prompt.
 *
 * Intentionally minimal — this is the placeholder shell that proves the
 * theme + primitives + i18n bootstrap pipeline works end to end.
 */
export function WelcomeScreen({
  onSignIn,
  onSignUp,
}: {
  onSignIn?: () => void;
  onSignUp?: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="displayLg">{t("common.appName")}</Text>
          <Text variant="titleLg" tone="muted">
            {t("auth.welcome.title")}
          </Text>
          <Text variant="body" tone="muted">
            {t("auth.welcome.subtitle")}
          </Text>
        </View>

        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Button
              label={t("auth.welcome.signIn")}
              fullWidth
              onPress={onSignIn}
            />
            <Button
              label={t("auth.welcome.signUp")}
              variant="secondary"
              fullWidth
              onPress={onSignUp}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
