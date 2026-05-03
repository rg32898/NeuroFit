import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen, Text } from "../../components/ui";
import { useTheme } from "../../theme";
import {
  annualPerMonthEquivalent,
  formatPrice,
  type Plan,
} from "../../lib/subscription-api";

export type PlansScreenProps = {
  plans: Plan[];
  loading?: boolean;
  error?: Error | null;
  onSubscribe: (plan: Plan) => void;
  onContinueFree: () => void;
};

/**
 * Plans paywall. FR-6.1, FR-6.2, FR-6.5:
 *   - Default selection is the monthly plan (cheapest), NOT the most
 *     expensive (which is what dark-pattern apps do).
 *   - Each card shows full price, billing period, equivalent per-month
 *     for annual, trial duration, and "cancel anytime".
 *   - A persistent "Continue with free version" link sits below the CTA.
 *
 * Selection is local component state on first render; we never auto-flip
 * it after the user has interacted.
 */
export function PlansScreen({
  plans,
  loading,
  error,
  onSubscribe,
  onContinueFree,
}: PlansScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  // FR-6.2: lock the default to the monthly plan on first render. We use
  // useMemo + useState so we never re-derive once the user has clicked.
  const defaultId = React.useMemo<"monthly" | "yearly">(() => "monthly", []);
  const [selectedId, setSelectedId] = React.useState<"monthly" | "yearly">(
    defaultId,
  );
  const selected = plans.find((p) => p.id === selectedId) ?? null;

  if (loading && plans.length === 0) {
    return (
      <Screen scrollable={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && plans.length === 0) {
    return (
      <Screen scrollable={false}>
        <View style={styles.center}>
          <Text variant="titleMd">{t("plans.errorTitle")}</Text>
          <Text tone="muted" style={{ textAlign: "center", marginTop: 8 }}>
            {t("plans.errorBody")}
          </Text>
        </View>
      </Screen>
    );
  }

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
            {t("plans.eyebrow")}
          </Text>
          <Text variant="displayMd">{t("plans.title")}</Text>
          <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
            {t("plans.subtitle")}
          </Text>
        </View>

        {plans.map((plan) => {
          const isSelected = plan.id === selectedId;
          const perMonthLine =
            plan.period === "year"
              ? t("plans.perMonthEquivalent", {
                  amount: annualPerMonthEquivalent(plan),
                })
              : null;
          return (
            <Pressable
              key={plan.id}
              onPress={() => setSelectedId(plan.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              testID={`plan-card-${plan.id}`}
            >
              <Card
                padding="lg"
                style={{
                  borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.border,
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMd">{plan.title}</Text>
                    <Text
                      variant="caption"
                      tone="muted"
                      style={{ marginTop: 4 }}
                    >
                      {t(`plans.period.${plan.period}`)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                    ]}
                  >
                    {isSelected ? (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      />
                    ) : null}
                  </View>
                </View>

                <View style={{ marginTop: theme.spacing.md }}>
                  <Text
                    variant="displayLg"
                    testID={`plan-price-${plan.id}`}
                  >
                    {formatPrice(plan.priceCents, plan.currency)}
                  </Text>
                  {perMonthLine ? (
                    <Text tone="muted" testID={`plan-per-month-${plan.id}`}>
                      {perMonthLine}
                    </Text>
                  ) : null}
                </View>

                <View style={{ marginTop: theme.spacing.md, gap: 4 }}>
                  <Text
                    variant="caption"
                    style={{ color: theme.colors.success }}
                    testID={`plan-trial-${plan.id}`}
                  >
                    {t("plans.trial", { days: plan.trialDays })}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {t("plans.cancelAnytime")}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}

        <Button
          label={
            selected
              ? t("plans.subscribeCta", {
                  amount: formatPrice(selected.priceCents, selected.currency),
                })
              : t("plans.subscribeCtaFallback")
          }
          fullWidth
          size="lg"
          onPress={() => selected && onSubscribe(selected)}
          disabled={!selected}
          testID="plans-subscribe-cta"
        />

        <Pressable
          onPress={onContinueFree}
          accessibilityRole="link"
          testID="plans-continue-free"
          style={{ alignSelf: "center", padding: theme.spacing.sm }}
        >
          <Text
            tone="muted"
            style={{ textDecorationLine: "underline" }}
          >
            {t("plans.continueFree")}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
});
