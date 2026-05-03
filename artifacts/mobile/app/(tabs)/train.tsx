import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameCard } from "@/components/GameCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { showRewardedAd } from "@app/lib/ads";
import { useSubscriptionStatus } from "@app/lib/subscription-api";

export const GAMES = [
  {
    id: "memory",
    name: "Memory Match",
    description: "Flip cards and find all matching pairs",
    icon: "grid" as const,
    accentColor: "#6366F1",
    difficulty: 2 as const,
  },
  {
    id: "sequence",
    name: "Number Recall",
    description: "Memorize and repeat number sequences",
    icon: "list" as const,
    accentColor: "#10B981",
    difficulty: 2 as const,
  },
  {
    id: "reaction",
    name: "Reaction Time",
    description: "Tap as fast as possible when the signal appears",
    icon: "zap" as const,
    accentColor: "#F59E0B",
    difficulty: 1 as const,
  },
  {
    id: "pattern",
    name: "Pattern Finder",
    description: "Spot the odd one out before time runs out",
    icon: "layers" as const,
    accentColor: "#EC4899",
    difficulty: 3 as const,
  },
];

export default function TrainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBestScore } = useApp();
  const subStatus = useSubscriptionStatus();
  // Only show the CTA once we KNOW the user is on a free-tier status.
  // While the query is loading we treat the user as "unknown" and keep
  // the CTA hidden — premium users must never see (or be able to tap)
  // the ad button, even briefly during hydration.
  const isFreeUser =
    subStatus.isSuccess &&
    !!subStatus.data &&
    (subStatus.data.status === "free" ||
      subStatus.data.status === "expired" ||
      subStatus.data.status === "canceled");
  const [unlocked, setUnlocked] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  // FR-7.x — opt-in only. The CTA is hidden for premium users entirely
  // and never auto-plays an ad. The user must explicitly tap.
  const onUnlockTap = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const earned = await showRewardedAd("unlock_premium_game");
      if (earned) {
        setUnlocked(true);
      } else {
        Alert.alert(
          "No ad available",
          "Try again later, or subscribe to unlock all games.",
        );
      }
    } finally {
      setAdLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Train</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Choose a game to sharpen your mind
        </Text>
      </View>

      {/* Featured / hardest */}
      <View
        style={[
          styles.featuredBanner,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
            borderLeftWidth: 3,
            borderLeftColor: "#EC4899",
          },
        ]}
      >
        <Feather name="trending-up" size={14} color="#EC4899" />
        <Text style={[styles.featuredText, { color: colors.mutedForeground }]}>
          Pattern Finder is today&apos;s featured challenge
        </Text>
      </View>

      {isFreeUser && !unlocked && (
        <Pressable
          onPress={onUnlockTap}
          disabled={adLoading}
          accessibilityRole="button"
          accessibilityLabel="Watch ad to unlock today's premium game"
          style={[
            styles.adCta,
            {
              backgroundColor: colors.card,
              marginHorizontal: 20,
              borderRadius: colors.radius,
              opacity: adLoading ? 0.6 : 1,
            },
          ]}
        >
          <Feather name="gift" size={16} color="#10B981" />
          <Text style={[styles.adCtaText, { color: colors.foreground }]}>
            {adLoading
              ? "Loading ad…"
              : "Watch ad to unlock today's premium game"}
          </Text>
        </Pressable>
      )}
      {isFreeUser && unlocked && (
        <View
          style={[
            styles.adCta,
            {
              backgroundColor: colors.card,
              marginHorizontal: 20,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="check-circle" size={16} color="#10B981" />
          <Text style={[styles.adCtaText, { color: colors.foreground }]}>
            Premium game unlocked for today
          </Text>
        </View>
      )}

      <View style={{ marginHorizontal: 20, marginTop: 20 }}>
        {GAMES.map((game) => (
          <GameCard
            key={game.id}
            id={game.id}
            name={game.name}
            description={game.description}
            icon={game.icon}
            accentColor={game.accentColor}
            bestScore={getBestScore(game.id)}
            difficulty={game.difficulty}
          />
        ))}
      </View>

      {/* Info box */}
      <View
        style={[
          styles.infoBox,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Feather name="info" size={14} color={colors.mutedForeground} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Each game earns XP. Difficulty dots show relative challenge level.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4,
  },
  title: { fontSize: 30, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  featuredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 4,
  },
  featuredText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  adCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginTop: 8,
  },
  adCtaText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
});
