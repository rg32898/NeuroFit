import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Phase = "idle" | "waiting" | "ready" | "result" | "gameover";

const TOTAL_ROUNDS = 5;

export default function ReactionGame() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addGameResult } = useApp();

  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [tooEarly, setTooEarly] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReady = useCallback(() => {
    const delay = 1500 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      startTimeRef.current = Date.now();
      setPhase("ready");
    }, delay);
  }, []);

  const startRound = useCallback(() => {
    setTooEarly(false);
    setCurrentMs(0);
    setPhase("waiting");
    scheduleReady();
  }, [scheduleReady]);

  const handlePress = useCallback(() => {
    if (phase === "idle") {
      setRound(1);
      startRound();
      return;
    }

    if (phase === "waiting") {
      // Too early
      if (timerRef.current) clearTimeout(timerRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTooEarly(true);
      setPhase("result");
      return;
    }

    if (phase === "ready") {
      const ms = Date.now() - startTimeRef.current;
      setCurrentMs(ms);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newResults = [...results, ms];
      setResults(newResults);
      setPhase("result");

      if (newResults.length >= TOTAL_ROUNDS) {
        // Game over
        const avg = Math.round(
          newResults.reduce((a, b) => a + b, 0) / newResults.length,
        );
        const score = Math.max(50, 1000 - avg);
        setTimeout(() => {
          setPhase("gameover");
          addGameResult({
            gameId: "reaction",
            gameName: "Reaction Time",
            score,
          });
        }, 1000);
      }
      return;
    }

    if (phase === "result") {
      const nextRound = round + 1;
      setRound(nextRound);
      startRound();
    }
  }, [phase, round, results, startRound, addGameResult]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const avg =
    results.length > 0
      ? Math.round(results.reduce((a, b) => a + b, 0) / results.length)
      : 0;

  const finalScore = Math.max(50, 1000 - avg);

  const circleColor =
    phase === "ready"
      ? "#10B981"
      : phase === "waiting"
        ? "#F59E0B"
        : phase === "idle"
          ? colors.primary
          : colors.secondary;

  const labelText = () => {
    if (phase === "idle") return "Tap to Start";
    if (phase === "waiting") return "Wait...";
    if (phase === "ready") return "TAP!";
    if (phase === "result") {
      if (tooEarly) return "Too early!";
      return round < TOTAL_ROUNDS ? "Tap to continue" : "Finished!";
    }
    if (phase === "gameover") return "Done!";
    return "";
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Reaction Time",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      />
      <Pressable
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 },
        ]}
        onPress={handlePress}
      >
        {/* Round dots */}
        <View style={styles.roundRow}>
          {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i < results.length
                      ? "#10B981"
                      : i === results.length && phase !== "idle"
                        ? "#F59E0B"
                        : colors.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Big tap circle */}
        <View style={styles.circleWrap}>
          <View
            style={[
              styles.circle,
              {
                backgroundColor: circleColor + "22",
                borderColor: circleColor,
                borderWidth: 3,
              },
            ]}
          >
            <Feather
              name={phase === "ready" ? "zap" : "circle"}
              size={56}
              color={circleColor}
            />
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusArea}>
          <Text style={[styles.mainLabel, { color: colors.foreground }]}>
            {labelText()}
          </Text>

          {phase === "result" && !tooEarly && currentMs > 0 && (
            <Text style={[styles.msText, { color: "#10B981" }]}>
              {currentMs} ms
            </Text>
          )}

          {phase === "result" && tooEarly && (
            <Text style={[styles.tooEarlyText, { color: colors.destructive }]}>
              Wait for green!
            </Text>
          )}

          {results.length > 0 && phase !== "idle" && (
            <Text style={[styles.avgText, { color: colors.mutedForeground }]}>
              Avg: {avg} ms
            </Text>
          )}

          {phase === "idle" && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Tap the circle when it turns green
            </Text>
          )}
        </View>

        {/* Round display */}
        {phase !== "idle" && phase !== "gameover" && (
          <Text style={[styles.roundText, { color: colors.mutedForeground }]}>
            Round {Math.min(round, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
          </Text>
        )}

        {/* Results breakdown */}
        {results.length > 0 && (
          <View
            style={[
              styles.resultsBox,
              { backgroundColor: colors.card, borderRadius: colors.radius },
            ]}
          >
            {results.map((ms, i) => (
              <View key={i} style={styles.resultRow}>
                <Text
                  style={[styles.resultRound, { color: colors.mutedForeground }]}
                >
                  #{i + 1}
                </Text>
                <View style={styles.resultBar}>
                  <View
                    style={[
                      styles.resultBarFill,
                      {
                        backgroundColor: "#10B981",
                        width: `${Math.min(100, (ms / 800) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.resultMs, { color: "#10B981" }]}>
                  {ms}ms
                </Text>
              </View>
            ))}
          </View>
        )}

        {phase === "gameover" && (
          <View style={styles.endArea}>
            <View
              style={[
                styles.scoreBox,
                { backgroundColor: colors.card, borderRadius: colors.radius },
              ]}
            >
              <Text style={[styles.finalScore, { color: colors.primary }]}>
                {finalScore}
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>
                points · avg {avg}ms
              </Text>
            </View>
            <View style={styles.endBtns}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setRound(0);
                  setResults([]);
                  setPhase("idle");
                }}
                style={[
                  styles.endBtn,
                  { backgroundColor: colors.primary, borderRadius: colors.radius },
                ]}
              >
                <Text style={styles.endBtnTxt}>Play Again</Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.back();
                }}
                style={[
                  styles.endBtn,
                  { backgroundColor: colors.card, borderRadius: colors.radius },
                ]}
              >
                <Text style={[styles.endBtnTxt, { color: colors.foreground }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: "center", gap: 20 },
  roundRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  circleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxHeight: 280,
    width: "100%",
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  statusArea: { alignItems: "center", gap: 6 },
  mainLabel: { fontSize: 28, fontFamily: "Inter_700Bold" },
  msText: { fontSize: 42, fontFamily: "Inter_700Bold" },
  tooEarlyText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  avgText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  hintText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  roundText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultsBox: { width: "100%", padding: 14, gap: 8 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultRound: { fontSize: 12, fontFamily: "Inter_500Medium", width: 24 },
  resultBar: { flex: 1, height: 6, backgroundColor: "#1E2A42", borderRadius: 3, overflow: "hidden" },
  resultBarFill: { height: 6, borderRadius: 3 },
  resultMs: { fontSize: 12, fontFamily: "Inter_600SemiBold", width: 48, textAlign: "right" },
  endArea: { width: "100%", gap: 12 },
  scoreBox: { padding: 16, alignItems: "center", gap: 4 },
  finalScore: { fontSize: 48, fontFamily: "Inter_700Bold" },
  scoreLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  endBtns: { flexDirection: "row", gap: 10 },
  endBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  endBtnTxt: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
