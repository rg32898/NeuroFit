import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import {
  formatPrice,
  type Plan,
  type SubscriptionSummary,
} from "../../lib/subscription-api";

export type SubscriptionStatusScreenProps = {
  summary: SubscriptionSummary | null;
  plans: Plan[];
  loading?: boolean;
  cancelling?: boolean;
  onCancel: () => Promise<void> | void;
  onRequestRefund: () => void;
  onUpgrade: () => void;
};

/**
 * The "current subscription" management screen. Shows plan, period end,
 * exact next-charge amount/date (FR-6.6 — no surprise auto-renew) and a
 * single, big, visible Cancel button (FR-6.5 — easy unsubscribe).
 *
 * Cancel uses ONE confirm dialog (no counter-offers, no "are you sure?
 * are you really really sure?" walls — FR-6.5/FR-6.11).
 */
export function SubscriptionStatusScreen({
  summary,
  plans,
  loading,
  cancelling,
  onCancel,
  onRequestRefund,
  onUpgrade,
}: SubscriptionStatusScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (loading && !summary) {
    return (
      <Screen scrollable={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  const s = summary ?? {
    status: "free" as const,
    plan: "free" as const,
    provider: "none" as const,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
  };

  const plan = plans.find((p) => p.id === s.plan) ?? null;
  const isPaid = s.plan !== "free";

  const periodEndDate = s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null;
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleCancel = () => {
    Alert.alert(
      t("subscription.confirmCancelTitle"),
      periodEndDate
        ? t("subscription.confirmCancelBody", {
            date: formatDate(periodEndDate),
          })
        : t("subscription.confirmCancelBodyNoDate"),
      [
        { text: t("subscription.confirmKeep"), style: "cancel" },
        {
          text: t("subscription.confirmCancelCta"),
          style: "destructive",
          onPress: () => {
            void onCancel();
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
            {t("subscription.eyebrow")}
          </Text>
          <Text variant="displayMd">{t("subscription.title")}</Text>
        </View>

        <Card>
          <Text variant="caption" tone="muted">
            {t("subscription.statusLabel")}
          </Text>
          <Text
            variant="titleLg"
            style={{ marginTop: 4 }}
            testID="subscription-status-value"
          >
            {t(`subscription.statusValue.${s.status}`)}
          </Text>

          {plan ? (
            <View style={{ marginTop: theme.spacing.md, gap: 8 }}>
              <Text>
                <Text tone="muted">{t("subscription.planLabel")}: </Text>
                {plan.title}
              </Text>
              {periodEndDate ? (
                <Text testID="subscription-next-charge">
                  <Text tone="muted">
                    {s.cancelAtPeriodEnd
                      ? t("subscription.endsOn")
                      : t("subscription.nextCharge")}
                    :{" "}
                  </Text>
                  {formatPrice(plan.priceCents, plan.currency)} ·{" "}
                  {formatDate(periodEndDate)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {!isPaid ? (
          <Button
            label={t("subscription.upgradeCta")}
            fullWidth
            size="lg"
            onPress={onUpgrade}
            testID="subscription-upgrade-cta"
          />
        ) : null}

        {isPaid && !s.cancelAtPeriodEnd ? (
          <Button
            label={t("subscription.cancelCta")}
            fullWidth
            size="lg"
            variant="danger"
            loading={cancelling}
            onPress={handleCancel}
            testID="subscription-cancel-cta"
          />
        ) : null}

        {isPaid && s.cancelAtPeriodEnd ? (
          <Card>
            <Text variant="titleMd">
              {t("subscription.cancelledTitle")}
            </Text>
            <Text tone="muted" style={{ marginTop: 4 }}>
              {periodEndDate
                ? t("subscription.cancelledBody", {
                    date: formatDate(periodEndDate),
                  })
                : t("subscription.cancelledBodyNoDate")}
            </Text>
          </Card>
        ) : null}

        {isPaid ? (
          <Button
            label={t("subscription.refundCta")}
            fullWidth
            variant="secondary"
            onPress={onRequestRefund}
            testID="subscription-refund-cta"
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
