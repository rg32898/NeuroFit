import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const QUICK_GAMES = [
  { id: "reaction", name: "Reaction", icon: "zap" as const, color: "#F59E0B" },
  { id: "sequence", name: "Sequence", icon: "list" as const, color: "#10B981" },
  { id: "pattern", name: "Pattern", icon: "layers" as const, color: "#EC4899" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    streak,
    totalXP,
    gameResults,
    dailyChallengeCompleted,
    getBestScore,
  } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const recentResults = gameResults.slice(0, 4);
  const level = Math.floor(totalXP / 500) + 1;
  const xpInLevel = totalXP % 500;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            NeuroFit
          </Text>
        </View>
        <View
          style={[
            styles.streakBadge,
            { backgroundColor: colors.card, borderRadius: 24 },
          ]}
        >
          <Feather name="zap" size={14} color="#F59E0B" />
          <Text style={[styles.streakText, { color: colors.foreground }]}>
            {streak}
          </Text>
          <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
            day streak
          </Text>
        </View>
      </View>

      {/* XP Level Bar */}
      <View
        style={[
          styles.xpCard,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.xpRow}>
          <View>
            <Text style={[styles.xpLevel, { color: colors.foreground }]}>
              Level {level}
            </Text>
            <Text style={[styles.xpTotal, { color: colors.mutedForeground }]}>
              {totalXP.toLocaleString()} total XP
            </Text>
          </View>
          <View
            style={[
              styles.xpBadge,
              { backgroundColor: colors.primary + "26" },
            ]}
          >
            <Text style={[styles.xpBadgeText, { color: colors.primary }]}>
              {xpInLevel}/500
            </Text>
          </View>
        </View>
        <View
          style={[styles.xpTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              styles.xpFill,
              {
                backgroundColor: colors.primary,
                width: `${(xpInLevel / 500) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Daily Challenge */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        DAILY CHALLENGE
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.dailyWrap,
          { marginHorizontal: 20, borderRadius: colors.radius, overflow: "hidden", opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/game/memory" as never);
        }}
      >
        <LinearGradient
          colors={
            dailyChallengeCompleted
              ? (["#1E2A42", "#1E2A42"] as [string, string])
              : (["#4338CA", "#7C3AED"] as [string, string])
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dailyGrad}
        >
          <View style={styles.dailyRow}>
            <View>
              <Text style={styles.dailyTag}>
                {dailyChallengeCompleted ? "COMPLETED" : "TODAY"}
              </Text>
              <Text style={styles.dailyName}>Memory Match</Text>
              <Text style={styles.dailyDesc}>
                {dailyChallengeCompleted
                  ? "Come back tomorrow for a new challenge"
                  : "Flip cards, find all pairs"}
              </Text>
            </View>
            <View style={styles.dailyIconBg}>
              <Feather
                name={dailyChallengeCompleted ? "check-circle" : "grid"}
                size={28}
                color="#fff"
              />
            </View>
          </View>
          {!dailyChallengeCompleted && (
            <View style={styles.rewardRow}>
              <Feather name="star" size={12} color="#FCD34D" />
              <Text style={styles.rewardText}>+50 bonus XP</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>

      {/* Quick Play */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        QUICK PLAY
      </Text>
      <View style={styles.quickRow}>
        {QUICK_GAMES.map((g) => (
          <Pressable
            key={g.id}
            style={({ pressed }) => [
              styles.quickCard,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/game/${g.id}` as never);
            }}
          >
            <View
              style={[
                styles.quickIcon,
                {
                  backgroundColor: g.color + "26",
                  borderRadius: 12,
                },
              ]}
            >
              <Feather name={g.icon} size={22} color={g.color} />
            </View>
            <Text style={[styles.quickName, { color: colors.foreground }]}>
              {g.name}
            </Text>
            <Text style={[styles.quickBest, { color: colors.mutedForeground }]}>
              {getBestScore(g.id) > 0 ? `${getBestScore(g.id)}` : "—"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Recent Activity */}
      {recentResults.length > 0 && (
        <>
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            RECENT ACTIVITY
          </Text>
          <View style={{ marginHorizontal: 20 }}>
            {recentResults.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.actRow,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.actDot,
                    { backgroundColor: colors.primary + "26" },
                  ]}
                >
                  <Feather name="activity" size={12} color={colors.primary} />
                </View>
                <Text
                  style={[styles.actGame, { color: colors.foreground }]}
                >
                  {r.gameName}
                </Text>
                <Text style={[styles.actScore, { color: colors.primary }]}>
                  {r.score}
                </Text>
                <Text
                  style={[styles.actDate, { color: colors.mutedForeground }]}
                >
                  {r.date}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {recentResults.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="cpu" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Play a game to see your activity
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  title: { fontSize: 30, fontFamily: "Inter_700Bold", marginTop: 2 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  streakText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  streakLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  xpCard: { padding: 16, marginBottom: 28 },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  xpLevel: { fontSize: 17, fontFamily: "Inter_700Bold" },
  xpTotal: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  xpBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  xpBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  xpTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  xpFill: { height: 6, borderRadius: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginHorizontal: 20,
    marginTop: 4,
  },
  dailyWrap: { marginBottom: 28 },
  dailyGrad: { padding: 20 },
  dailyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dailyTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  dailyName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginTop: 4,
  },
  dailyDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    maxWidth: 200,
  },
  dailyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 14,
  },
  rewardText: {
    fontSize: 12,
    color: "#FCD34D",
    fontFamily: "Inter_500Medium",
  },
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 28,
  },
  quickCard: { flex: 1, padding: 14, alignItems: "center", gap: 8 },
  quickIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  quickName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  quickBest: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actGame: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  actScore: { fontSize: 15, fontFamily: "Inter_700Bold" },
  actDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
