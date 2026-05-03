import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../lib/api";
import { Button, Card, Input, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type LoginScreenProps = {
  /** Submit handler — should throw on auth failure so the screen can render an error. */
  onSubmit: (email: string, password: string) => Promise<void>;
  /** Navigate to the register screen. */
  onCreateAccount: () => void;
};

/**
 * Email + password sign-in. OAuth buttons (Apple / Google) are visible
 * but stubbed per spec (alert "Coming soon"). The screen is purely
 * presentational; the route wrapper supplies `onSubmit` that calls the
 * auth store.
 */
export function LoginScreen({ onSubmit, onCreateAccount }: LoginScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function comingSoon(provider: string) {
    Alert.alert(
      t("onboarding.login.comingSoonTitle"),
      t("onboarding.login.comingSoonMessage", { provider }),
    );
  }

  function friendlyError(err: unknown): string {
    if (err instanceof ApiError) {
      // Map known codes to friendlier copy; fall back to the server message
      // for everything else (still safe — backend uses sanitized messages).
      switch (err.code) {
        case "INVALID_CREDENTIALS":
          return t("onboarding.login.errors.invalidCredentials");
        case "RATE_LIMITED":
          return t("onboarding.login.errors.rateLimited");
        case "VALIDATION_ERROR":
          return t("onboarding.login.errors.validation");
        default:
          return err.message || t("common.error");
      }
    }
    if (err instanceof Error && err.message) return err.message;
    return t("common.error");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(email.trim(), password);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="displayMd">{t("onboarding.login.title")}</Text>
        <Text variant="body" tone="muted">
          {t("onboarding.login.subtitle")}
        </Text>
      </View>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label={t("onboarding.login.emailLabel")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder={t("onboarding.login.emailPlaceholder")}
            editable={!submitting}
          />
          <Input
            label={t("onboarding.login.passwordLabel")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            editable={!submitting}
          />

          {error ? (
            <Text
              variant="caption"
              tone="danger"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <Button
            label={t("onboarding.login.submit")}
            fullWidth
            loading={submitting}
            onPress={() => void handleSubmit()}
          />
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
          {t("onboarding.login.orContinueWith")}
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={t("onboarding.login.apple")}
            variant="secondary"
            fullWidth
            onPress={() => comingSoon("Apple")}
          />
          <Button
            label={t("onboarding.login.google")}
            variant="secondary"
            fullWidth
            onPress={() => comingSoon("Google")}
          />
        </View>
      </View>

      <Button
        label={t("onboarding.login.createAccount")}
        variant="ghost"
        fullWidth
        onPress={onCreateAccount}
        disabled={submitting}
      />
    </Screen>
  );
}
