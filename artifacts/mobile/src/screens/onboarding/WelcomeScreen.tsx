import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { HeroOrb } from "../../components/brand/HeroOrb";
import { Logo } from "../../components/brand/Logo";
import { Text } from "../../components/ui";
import { useTheme } from "../../theme";

export type WelcomeScreenProps = {
  /** Primary CTA — guest path. Should ensure a guest id and route to assessment. */
  onTryWorkout: () => void;
  /** Secondary CTA — returning user path. Routes to login. */
  onSignIn: () => void;
};

type ValueProp = { icon: keyof typeof Feather.glyphMap; label: string };

const VALUE_PROPS: ValueProp[] = [
  { icon: "zap", label: "5-min sessions" },
  { icon: "target", label: "Adaptive difficulty" },
  { icon: "trending-up", label: "Track progress" },
];

/**
 * Onboarding entry point. Per FR-1.1, the primary CTA is the no-account
 * path so users can start a workout in <60s without friction. Sign-in is
 * the secondary path. Critically, this screen NEVER shows pricing or a
 * paywall — that's deferred until after session 3 (FR-1.5).
 *
 * Visual design:
 *  - Deep indigo→black radial gradient ground
 *  - Animated hero orb with two counter-rotating orbits
 *  - Brand logo + wordmark above the headline
 *  - Glassy primary CTA with gradient fill, ghost secondary
 *  - Value-prop chip row beneath the CTAs
 *  - Trust note at the very bottom
 */
export function WelcomeScreen({ onTryWorkout, onSignIn }: WelcomeScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* Background gradient — deep cosmic indigo */}
      <LinearGradient
        colors={["#0A0E1A", "#141B33", "#1B1240", "#0A0E1A"]}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft top accent glow */}
      <LinearGradient
        colors={["rgba(99, 102, 241, 0.35)", "rgba(99, 102, 241, 0)"]}
        style={[styles.topGlow, { height: 320 + insets.top }]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + theme.spacing.xl,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand bar */}
        <View style={styles.brandRow}>
          <Logo size={36} glow={false} />
          <Text variant="titleMd" style={styles.wordmark}>
            NeuroFit
          </Text>
          <View style={styles.brandSpacer} />
          <View style={styles.betaPill}>
            <Text variant="caption" style={styles.betaPillText}>
              BETA
            </Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <HeroOrb size={260} />
        </View>

        {/* Headline */}
        <View style={styles.headline}>
          <Text variant="caption" style={styles.eyebrow}>
            DAILY BRAIN TRAINING
          </Text>
          <Text variant="displayLg" style={styles.title}>
            {t("onboarding.welcome.title")}
          </Text>
          <Text variant="bodyLg" style={styles.subtitle}>
            {t("onboarding.welcome.subtitle")}
          </Text>
        </View>

        {/* Value props */}
        <View style={styles.valueRow}>
          {VALUE_PROPS.map((p) => (
            <View key={p.label} style={styles.valueChip}>
              <Feather name={p.icon} size={14} color="#A5B4FC" />
              <Text variant="caption" style={styles.valueLabel}>
                {p.label}
              </Text>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <PrimaryCTA
            label={t("onboarding.welcome.tryWorkout")}
            onPress={onTryWorkout}
          />
          <SecondaryCTA
            label={t("onboarding.welcome.haveAccount")}
            onPress={onSignIn}
          />
        </View>

        {/* Trust note */}
        <View style={styles.trustRow}>
          <Feather name="shield" size={12} color="rgba(255,255,255,0.55)" />
          <Text variant="caption" style={styles.trustText}>
            {t("onboarding.welcome.noPaymentNote")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PrimaryCTA({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primaryCtaWrap,
        pressed && Platform.OS !== "web" ? { transform: [{ scale: 0.985 }] } : null,
        pressed ? { opacity: 0.92 } : null,
      ]}
    >
      <LinearGradient
        colors={["#7C8CFF", "#6366F1", "#06B6D4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryCta}
      >
        <Text variant="button" style={styles.primaryCtaLabel}>
          {label}
        </Text>
        <Feather name="arrow-right" size={18} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryCTA({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.secondaryCta,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      <Text variant="button" style={styles.secondaryCtaLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0E1A",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  wordmark: {
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  brandSpacer: {
    flex: 1,
  },
  betaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(165, 180, 252, 0.55)",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  betaPillText: {
    color: "#A5B4FC",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  headline: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
  eyebrow: {
    color: "#A5B4FC",
    letterSpacing: 2.4,
    fontSize: 11,
  },
  title: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.72)",
    textAlign: "center",
    maxWidth: 360,
    lineHeight: 24,
  },
  valueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  valueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  valueLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
  },
  ctas: {
    gap: 12,
    marginTop: 12,
  },
  primaryCtaWrap: {
    borderRadius: 16,
    overflow: "hidden",
    // Glow shadow for the gradient CTA. iOS picks up shadow*; Android uses elevation.
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  primaryCtaLabel: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  secondaryCta: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  secondaryCtaLabel: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  trustText: {
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
    fontSize: 11.5,
  },
});
