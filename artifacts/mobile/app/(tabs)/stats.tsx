import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProgressRing } from "@/components/ProgressRing";
import { StatCard } from "@/components/StatCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const GAME_META: Record<
  string,
  { name: string; color: string; icon: "grid" | "list" | "zap" | "layers" }
> = {
  memory: { name: "Memory Match", color: "#6366F1", icon: "grid" },
  sequence: { name: "Number Recall", color: "#10B981", icon: "list" },
  reaction: { name: "Reaction Time", color: "#F59E0B", icon: "zap" },
  pattern: { name: "Pattern Finder", color: "#EC4899", icon: "layers" },
};

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { streak, totalXP, totalSessions, getBestScore, getRecentResults } = useApp();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const level = Math.floor(totalXP / 500) + 1;
  const xpInLevel = totalXP % 500;
  const levelProgress = xpInLevel / 500;

  const recentResults = getRecentResults(10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Stats</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your brain performance overview
        </Text>
      </View>

      {/* Level ring */}
      <View
        style={[
          styles.levelCard,
          {
            backgroundColor: colors.card,
            marginHorizontal: 20,
            borderRadius: colors.radius,
          },
        ]}
      >
        <ProgressRing
          progress={levelProgress}
          size={100}
          strokeWidth={9}
          color={colors.primary}
          trackColor={colors.border}
        >
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.ringLevel, { color: colors.foreground }]}>
              {level}
            </Text>
            <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>
              LVL
            </Text>
          </View>
        </ProgressRing>

        <View style={styles.levelInfo}>
          <Text style={[styles.levelTitle, { color: colors.foreground }]}>
            Level {level}
          </Text>
          <Text style={[styles.levelXP, { color: colors.mutedForeground }]}>
            {totalXP.toLocaleString()} total XP
          </Text>
          <View style={[styles.xpTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.xpFill,
                {
                  backgroundColor: colors.primary,
                  width: `${levelProgress * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.xpNext, { color: colors.mutedForeground }]}>
            {500 - xpInLevel} XP to level {level + 1}
          </Text>
        </View>
      </View>

      {/* Stat cards row */}
      <View style={styles.statRow}>
        <StatCard
          label="Day Streak"
          value={streak}
          icon="zap"
          iconColor="#F59E0B"
        />
        <StatCard
          label="Sessions"
          value={totalSessions}
          icon="activity"
          iconColor={colors.primary}
        />
      </View>

      {/* Per-game bests */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
        PERSONAL BESTS
      </Text>
      <View style={{ marginHorizontal: 20 }}>
        {Object.entries(GAME_META).map(([id, meta]) => {
          const best = getBestScore(id);
          return (
            <View
              key={id}
              style={[
                styles.bestRow,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                  marginBottom: 10,
                },
              ]}
            >
              <View
                style={[
                  styles.bestIcon,
                  { backgroundColor: meta.color + "26", borderRadius: 10 },
                ]}
              >
                <Feather name={meta.icon} size={18} color={meta.color} />
              </View>
              <Text style={[styles.bestName, { color: colors.foreground }]}>
                {meta.name}
              </Text>
              <Text
                style={[
                  styles.bestScore,
                  { color: best > 0 ? meta.color : colors.mutedForeground },
                ]}
              >
                {best > 0 ? best : "—"}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Recent history */}
      {recentResults.length > 0 && (
        <>
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            HISTORY
          </Text>
          <View style={{ marginHorizontal: 20 }}>
            {recentResults.map((r) => {
              const meta = GAME_META[r.gameId];
              return (
                <View
                  key={r.id}
                  style={[
                    styles.histRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.histDot,
                      {
                        backgroundColor: (meta?.color ?? colors.primary) + "26",
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Feather
                      name={meta?.icon ?? "activity"}
                      size={12}
                      color={meta?.color ?? colors.primary}
                    />
                  </View>
                  <Text
                    style={[styles.histGame, { color: colors.foreground }]}
                  >
                    {r.gameName}
                  </Text>
                  <Text
                    style={[
                      styles.histScore,
                      { color: meta?.color ?? colors.primary },
                    ]}
                  >
                    {r.score}
                  </Text>
                  <Text
                    style={[
                      styles.histDate,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {r.date}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {recentResults.length === 0 && (
        <View style={styles.empty}>
          <Feather name="bar-chart-2" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Play games to build your stats
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 4 },
  title: { fontSize: 30, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 20,
    marginBottom: 16,
  },
  ringLevel: { fontSize: 24, fontFamily: "Inter_700Bold" },
  ringLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  levelInfo: { flex: 1, gap: 4 },
  levelTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  levelXP: { fontSize: 12, fontFamily: "Inter_400Regular" },
  xpTrack: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  xpFill: { height: 5, borderRadius: 3 },
  xpNext: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginHorizontal: 20,
    marginTop: 4,
  },
  bestRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  bestIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  bestName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  bestScore: { fontSize: 18, fontFamily: "Inter_700Bold" },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histDot: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  histGame: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  histScore: { fontSize: 14, fontFamily: "Inter_700Bold" },
  histDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 60,
    marginHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
