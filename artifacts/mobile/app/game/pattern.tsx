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

type Phase = "playing" | "result" | "gameover";

const PALETTES = [
  ["#6366F1", "#4F46E5"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#D97706"],
  ["#EC4899", "#DB2777"],
  ["#06B6D4", "#0891B2"],
  ["#8B5CF6", "#7C3AED"],
];

const TOTAL_ROUNDS = 6;
const TIME_PER_ROUND = 8;

function makeGrid(cols: number): { colors: string[]; oddIndex: number } {
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)] as [string, string];
  const [base, odd] = palette;
  const size = cols * cols;
  const oddIndex = Math.floor(Math.random() * size);
  const gridColors = Array.from({ length: size }, (_, i) =>
    i === oddIndex ? odd : base,
  );
  return { colors: gridColors, oddIndex };
}

export default function PatternGame() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addGameResult } = useApp();

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("playing");
  const [grid, setGrid] = useState(() => makeGrid(3));
  const [cols, setCols] = useState(3);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRound = useCallback((r: number) => {
    const c = r <= 2 ? 3 : r <= 4 ? 4 : 5;
    setCols(c);
    setGrid(makeGrid(c));
    setTimeLeft(TIME_PER_ROUND);
    setLastCorrect(null);
    setPhase("playing");
  }, []);

  useEffect(() => {
    startRound(1);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setLastCorrect(false);
          setPhase("result");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setTimeout(() => nextRound(), 1000);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, round]);

  const nextRound = useCallback(() => {
    if (round >= TOTAL_ROUNDS) {
      setPhase("gameover");
    } else {
      const next = round + 1;
      setRound(next);
      startRound(next);
    }
  }, [round, startRound]);

  const handleTap = useCallback(
    (idx: number) => {
      if (phase !== "playing") return;
      if (timerRef.current) clearInterval(timerRef.current);

      const correct = idx === grid.oddIndex;
      setLastCorrect(correct);
      setPhase("result");

      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const bonus = Math.floor((timeLeft / TIME_PER_ROUND) * 100);
        const roundScore = 100 + bonus;
        setTotalScore((s) => {
          const final = s + roundScore;
          if (round >= TOTAL_ROUNDS) {
            setPhase("gameover");
            addGameResult({
              gameId: "pattern",
              gameName: "Pattern Finder",
              score: final,
            });
          }
          return final;
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      if (round < TOTAL_ROUNDS) {
        setTimeout(() => nextRound(), 900);
      } else {
        setTimeout(() => {
          setPhase("gameover");
          setTotalScore((s) => {
            addGameResult({
              gameId: "pattern",
              gameName: "Pattern Finder",
              score: s,
            });
            return s;
          });
        }, 900);
      }
    },
    [phase, grid.oddIndex, timeLeft, round, nextRound, addGameResult],
  );

  const restart = () => {
    setRound(1);
    setTotalScore(0);
    setPhase("playing");
    startRound(1);
  };

  const cellSize = cols === 3 ? 88 : cols === 4 ? 72 : 58;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Pattern Finder",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      />
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 },
        ]}
      >
        {/* Header row */}
        <View style={styles.topRow}>
          <View
            style={[
              styles.roundBadge,
              { backgroundColor: "#EC4899" + "26" },
            ]}
          >
            <Text style={[styles.roundTxt, { color: "#EC4899" }]}>
              {round}/{TOTAL_ROUNDS}
            </Text>
          </View>

          {/* Timer bar */}
          <View style={[styles.timerWrap, { flex: 1, marginHorizontal: 12 }]}>
            <View style={[styles.timerTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.timerFill,
                  {
                    backgroundColor:
                      timeLeft > 4 ? "#10B981" : colors.destructive,
                    width: `${(timeLeft / TIME_PER_ROUND) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.timerNum, { color: colors.foreground }]}>
              {timeLeft}s
            </Text>
          </View>

          <Text style={[styles.scoreTxt, { color: colors.primary }]}>
            {totalScore}
          </Text>
        </View>

        <Text style={[styles.instruction, { color: colors.mutedForeground }]}>
          Find the different colored square
        </Text>

        {/* Grid */}
        <View style={styles.gridWrap}>
          <View
            style={[
              styles.grid,
              { gap: cols === 5 ? 6 : 8 },
            ]}
          >
            {grid.colors.map((color, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleTap(idx)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: color,
                    borderRadius: cols === 5 ? 10 : 12,
                    opacity: pressed ? 0.8 : 1,
                    borderWidth:
                      phase === "result" && idx === grid.oddIndex ? 3 : 0,
                    borderColor:
                      lastCorrect === true ? "#fff" : colors.destructive,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Result flash */}
        {phase === "result" && (
          <View style={styles.resultFlash}>
            <Feather
              name={lastCorrect ? "check-circle" : "x-circle"}
              size={28}
              color={lastCorrect ? "#10B981" : colors.destructive}
            />
            <Text
              style={[
                styles.resultTxt,
                { color: lastCorrect ? "#10B981" : colors.destructive },
              ]}
            >
              {lastCorrect ? `+${100 + Math.floor((timeLeft / TIME_PER_ROUND) * 100)}` : "Miss!"}
            </Text>
          </View>
        )}

        {phase === "gameover" && (
          <View
            style={[
              styles.gameoverCard,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="award" size={40} color="#EC4899" />
            <Text style={[styles.goTitle, { color: colors.foreground }]}>
              Complete!
            </Text>
            <Text style={[styles.goScore, { color: "#EC4899" }]}>
              {totalScore}
            </Text>
            <Text style={[styles.goLabel, { color: colors.mutedForeground }]}>
              points
            </Text>
            <View style={styles.goBtns}>
              <Pressable
                onPress={restart}
                style={[
                  styles.goBtn,
                  { backgroundColor: "#EC4899", borderRadius: colors.radius },
                ]}
              >
                <Text style={styles.goBtnTxt}>Play Again</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                style={[
                  styles.goBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Text style={[styles.goBtnTxt, { color: colors.foreground }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, alignItems: "center" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  roundBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roundTxt: { fontSize: 13, fontFamily: "Inter_700Bold" },
  timerWrap: { gap: 4 },
  timerTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  timerFill: { height: 6, borderRadius: 3 },
  timerNum: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  scoreTxt: { fontSize: 18, fontFamily: "Inter_700Bold", minWidth: 50, textAlign: "right" },
  instruction: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  gridWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  cell: {},
  resultFlash: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
  },
  resultTxt: { fontSize: 22, fontFamily: "Inter_700Bold" },
  gameoverCard: {
    padding: 28,
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  goTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 6 },
  goScore: { fontSize: 52, fontFamily: "Inter_700Bold" },
  goLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  goBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  goBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  goBtnTxt: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
