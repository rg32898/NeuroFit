import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { HeroOrb } from "../../components/brand/HeroOrb";
import { Logo } from "../../components/brand/Logo";
import { Starfield } from "../../components/brand/Starfield";
import { Text } from "../../components/ui";
import { tapLight, tapPrimary } from "../../lib/feedback";
import { useTheme } from "../../theme";

export type WelcomeScreenProps = {
  onTryWorkout: () => void;
  onSignIn: () => void;
};

type ValueProp = { icon: keyof typeof Feather.glyphMap; label: string };
type GamePreview = {
  icon: keyof typeof Feather.glyphMap;
  name: string;
  tint: string;
};

const VALUE_PROPS: ValueProp[] = [
  { icon: "zap", label: "5 min" },
  { icon: "target", label: "Adaptive" },
  { icon: "trending-up", label: "Tracked" },
];

const FEATURED_GAMES: GamePreview[] = [
  { icon: "grid", name: "Memory", tint: "#A78BFA" },
  { icon: "activity", name: "Reaction", tint: "#22D3EE" },
  { icon: "hexagon", name: "Pattern", tint: "#F472B6" },
  { icon: "list", name: "Sequence", tint: "#FBBF24" },
];

/**
 * Onboarding entry point. Per FR-1.1, primary CTA is the no-account path
 * so a new user can start training in <60s. Sign-in is secondary. NEVER
 * shows a paywall — that's deferred until after session 3 (FR-1.5).
 *
 * Visual layering (back→front):
 *  1. Cosmic indigo→violet→black background gradient
 *  2. Twinkling starfield
 *  3. Top + bottom accent glows
 *  4. Hero orb with two counter-rotating orbits
 *  5. Foreground content (brand, copy, chips, games card, CTAs)
 *
 * All sections fade + slide in with staggered delays for a deliberate,
 * cinematic entrance — no layout shift, no jank.
 */
export function WelcomeScreen({ onTryWorkout, onSignIn }: WelcomeScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handlePrimary = () => {
    tapPrimary();
    onTryWorkout();
  };
  const handleSecondary = () => {
    tapLight();
    onSignIn();
  };

  return (
    <View style={styles.root}>
      {/* Background — cosmic indigo */}
      <LinearGradient
        colors={["#070914", "#0F1430", "#1A0F38", "#070914"]}
        locations={[0, 0.32, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Starfield */}
      <Starfield count={42} />

      {/* Top accent glow */}
      <LinearGradient
        colors={["rgba(124, 140, 255, 0.4)", "rgba(124, 140, 255, 0)"]}
        style={[styles.topGlow, { height: 360 + insets.top }]}
      />
      {/* Bottom accent glow (cyan) */}
      <LinearGradient
        colors={["rgba(6, 182, 212, 0)", "rgba(6, 182, 212, 0.18)"]}
        style={[styles.bottomGlow, { height: 240 + insets.bottom }]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand bar */}
        <FadeIn delay={0}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <Logo size={30} glow={false} />
              <Text variant="titleMd" style={styles.wordmark} numberOfLines={1}>
                NeuroFit
              </Text>
            </View>
            <View style={styles.betaPill}>
              <View style={styles.betaDot} />
              <Text variant="caption" style={styles.betaPillText}>
                BETA
              </Text>
            </View>
          </View>
        </FadeIn>

        {/* Hero */}
        <FadeIn delay={120}>
          <View style={styles.hero}>
            <HeroOrb size={240} />
          </View>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={240}>
          <View style={styles.headline}>
            <Text variant="caption" style={styles.eyebrow} numberOfLines={1}>
              DAILY  ·  BRAIN  ·  TRAINING
            </Text>
            <Text variant="displayLg" style={styles.title}>
              {t("onboarding.welcome.title")}
            </Text>
            <Text variant="bodyLg" style={styles.subtitle}>
              {t("onboarding.welcome.subtitle")}
            </Text>
          </View>
        </FadeIn>

        {/* Value chips */}
        <FadeIn delay={340}>
          <View style={styles.valueRow}>
            {VALUE_PROPS.map((p) => (
              <View key={p.label} style={styles.valueChip}>
                <Feather name={p.icon} size={13} color="#A5B4FC" />
                <Text variant="caption" style={styles.valueLabel} numberOfLines={1}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {/* Featured games preview card */}
        <FadeIn delay={440}>
          <View style={styles.gamesCard}>
            <LinearGradient
              colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.gamesHeaderRow}>
              <Text variant="label" style={styles.gamesHeader} numberOfLines={1}>
                INSIDE THE APP
              </Text>
              <Text variant="caption" style={styles.gamesSub} numberOfLines={1}>
                4 games · more soon
              </Text>
            </View>
            <View style={styles.gamesGrid}>
              {FEATURED_GAMES.map((g) => (
                <View key={g.name} style={styles.gameTile}>
                  <View
                    style={[
                      styles.gameIcon,
                      { backgroundColor: `${g.tint}22`, borderColor: `${g.tint}55` },
                    ]}
                  >
                    <Feather name={g.icon} size={18} color={g.tint} />
                  </View>
                  <Text variant="caption" style={styles.gameName} numberOfLines={1}>
                    {g.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={540}>
          <View style={styles.ctas}>
            <PrimaryCTA
              label={t("onboarding.welcome.tryWorkout")}
              onPress={handlePrimary}
            />
            <SecondaryCTA
              label={t("onboarding.welcome.haveAccount")}
              onPress={handleSecondary}
            />
          </View>
        </FadeIn>

        {/* Social proof */}
        <FadeIn delay={620}>
          <View style={styles.socialRow}>
            <View style={styles.starRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Feather key={i} name="star" size={11} color="#FBBF24" />
              ))}
            </View>
            <Text variant="caption" style={styles.socialText} numberOfLines={1}>
              Loved by early testers
            </Text>
          </View>
        </FadeIn>

        {/* Trust note */}
        <FadeIn delay={700}>
          <View style={styles.trustRow}>
            <Feather name="shield" size={11} color="rgba(255,255,255,0.5)" />
            <Text variant="caption" style={styles.trustText}>
              {t("onboarding.welcome.noPaymentNote")}
            </Text>
          </View>
        </FadeIn>

        {/* Bottom safe spacer (theme reference keeps lint happy + avoids warning) */}
        <View style={{ height: theme.spacing.sm }} />
      </ScrollView>
    </View>
  );
}

/** Mounts children with a slight upward slide + opacity ease. */
function FadeIn({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration: 520, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 520, easing }));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
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
        pressed ? { opacity: 0.94 } : null,
      ]}
    >
      <LinearGradient
        colors={["#7C8CFF", "#6366F1", "#06B6D4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryCta}
      >
        <Text variant="button" style={styles.primaryCtaLabel} numberOfLines={1}>
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
      <Text variant="button" style={styles.secondaryCtaLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070914",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  wordmark: {
    color: "#FFFFFF",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  betaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(165, 180, 252, 0.55)",
    backgroundColor: "rgba(99, 102, 241, 0.14)",
    flexShrink: 0,
  },
  betaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A5B4FC",
  },
  betaPillText: {
    color: "#A5B4FC",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 0,
  },
  headline: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  eyebrow: {
    color: "#A5B4FC",
    letterSpacing: 2.2,
    fontSize: 10.5,
  },
  title: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.72)",
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 22,
    fontSize: 15,
  },
  valueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  valueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  valueLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
  },
  gamesCard: {
    borderRadius: 18,
    padding: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(20, 27, 51, 0.6)",
    gap: 12,
  },
  gamesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  gamesHeader: {
    color: "#A5B4FC",
    letterSpacing: 1.6,
    fontSize: 10.5,
    flexShrink: 1,
  },
  gamesSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    flexShrink: 0,
  },
  gamesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  gameTile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  gameIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  gameName: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 11,
  },
  ctas: {
    gap: 10,
  },
  primaryCtaWrap: {
    borderRadius: 16,
    overflow: "hidden",
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
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  primaryCtaLabel: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  secondaryCta: {
    paddingVertical: 15,
    paddingHorizontal: 18,
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
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
  },
  socialText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 12,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  trustText: {
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    fontSize: 11.5,
    flexShrink: 1,
  },
});
