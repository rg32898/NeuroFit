import React from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type AccountDeletionScreenProps = {
  email: string | null;
  scheduledAt: string | null;
  purgeAt: string | null;
  loading?: boolean;
  scheduling?: boolean;
  undoing?: boolean;
  onSchedule: () => Promise<void> | void;
  onUndo: () => Promise<void> | void;
  onCancel: () => void;
};

/**
 * Irreversible after the 14-day reverse window. We follow Apple's
 * "delete-my-account" rules — the user can recover during the window by
 * tapping Undo.
 *
 * Cancellation gets exactly ONE confirmation dialog (no counter-offers,
 * no surveys — FR-6.5).
 */
export function AccountDeletionScreen({
  email,
  scheduledAt,
  purgeAt,
  loading,
  scheduling,
  undoing,
  onSchedule,
  onUndo,
  onCancel,
}: AccountDeletionScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const purgeDate = purgeAt ? new Date(purgeAt) : null;
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleSchedule = () => {
    Alert.alert(
      t("accountDeletion.confirmTitle"),
      t("accountDeletion.confirmBody"),
      [
        { text: t("accountDeletion.confirmKeep"), style: "cancel" },
        {
          text: t("accountDeletion.confirmCta"),
          style: "destructive",
          onPress: () => {
            void onSchedule();
          },
        },
      ],
    );
  };

  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
          paddingBottom: 200,
        }}
      >
        <View>
          <Text variant="caption" tone="muted">
            {t("accountDeletion.eyebrow")}
          </Text>
          <Text variant="displayMd">{t("accountDeletion.title")}</Text>
          <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
            {email ?? t("accountDeletion.guest")}
          </Text>
        </View>

        {scheduledAt && purgeDate ? (
          <Card>
            <Text variant="titleMd">{t("accountDeletion.scheduledTitle")}</Text>
            <Text tone="muted" style={{ marginTop: 4 }}>
              {t("accountDeletion.scheduledBody", {
                date: formatDate(purgeDate),
              })}
            </Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <Button
                label={t("accountDeletion.undoCta")}
                fullWidth
                variant="primary"
                loading={undoing}
                onPress={() => {
                  void onUndo();
                }}
                testID="account-deletion-undo"
              />
            </View>
          </Card>
        ) : (
          <>
            <Card>
              <Text variant="titleMd">
                {t("accountDeletion.warningTitle")}
              </Text>
              <Text tone="muted" style={{ marginTop: theme.spacing.sm }}>
                {t("accountDeletion.warningBody")}
              </Text>
              <View style={{ marginTop: theme.spacing.md, gap: 6 }}>
                {(t("accountDeletion.bullets", {
                  returnObjects: true,
                  defaultValue: [],
                }) as string[]).map((b) => (
                  <Text key={b}>• {b}</Text>
                ))}
              </View>
            </Card>

            <Button
              label={t("accountDeletion.scheduleCta")}
              fullWidth
              size="lg"
              variant="danger"
              loading={scheduling || loading}
              onPress={handleSchedule}
              testID="account-deletion-schedule"
            />
          </>
        )}

        <Button
          label={t("accountDeletion.cancel")}
          fullWidth
          variant="ghost"
          onPress={onCancel}
        />
      </ScrollView>
    </Screen>
  );
}

const _styles = StyleSheet.create({});
