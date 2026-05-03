import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../lib/api";
import { Button, Card, Input, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type RegisterScreenProps = {
  /** Submit handler — should throw on failure so the screen can render an error. */
  onSubmit: (email: string, password: string) => Promise<void>;
  /** Navigate back to the login screen. */
  onSignIn: () => void;
};

/**
 * Email + password sign-up. Same shape as `LoginScreen` — OAuth buttons
 * are visible but stubbed; submission is delegated to a prop so the
 * route wrapper owns the auth-store call.
 */
export function RegisterScreen({ onSubmit, onSignIn }: RegisterScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function comingSoon(provider: string) {
    Alert.alert(
      t("onboarding.register.comingSoonTitle"),
      t("onboarding.register.comingSoonMessage", { provider }),
    );
  }

  function friendlyError(err: unknown): string {
    if (err instanceof ApiError) {
      switch (err.code) {
        case "EMAIL_TAKEN":
          return t("onboarding.register.errors.emailTaken");
        case "VALIDATION_ERROR":
          return t("onboarding.register.errors.validation");
        case "RATE_LIMITED":
          return t("onboarding.register.errors.rateLimited");
        default:
          return err.message || t("common.error");
      }
    }
    if (err instanceof Error && err.message) return err.message;
    return t("common.error");
  }

  async function handleSubmit() {
    if (password.length < 8) {
      setError(t("onboarding.register.errors.passwordTooShort"));
      return;
    }

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
        <Text variant="displayMd">{t("onboarding.register.title")}</Text>
        <Text variant="body" tone="muted">
          {t("onboarding.register.subtitle")}
        </Text>
      </View>

      <Card>
        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label={t("onboarding.register.emailLabel")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder={t("onboarding.register.emailPlaceholder")}
            editable={!submitting}
          />
          <Input
            label={t("onboarding.register.passwordLabel")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            helperText={t("onboarding.register.passwordHint")}
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
            label={t("onboarding.register.submit")}
            fullWidth
            loading={submitting}
            onPress={() => void handleSubmit()}
          />
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
          {t("onboarding.register.orContinueWith")}
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={t("onboarding.register.apple")}
            variant="secondary"
            fullWidth
            onPress={() => comingSoon("Apple")}
          />
          <Button
            label={t("onboarding.register.google")}
            variant="secondary"
            fullWidth
            onPress={() => comingSoon("Google")}
          />
        </View>
      </View>

      <Button
        label={t("onboarding.register.haveAccount")}
        variant="ghost"
        fullWidth
        onPress={onSignIn}
        disabled={submitting}
      />
    </Screen>
  );
}
