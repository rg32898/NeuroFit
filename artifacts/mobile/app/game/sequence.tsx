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

type Phase = "countdown" | "show" | "input" | "result" | "gameover";

function randomSeq(len: number): number[] {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1);
}

export default function SequenceGame() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addGameResult } = useApp();

  const TOTAL_ROUNDS = 5;

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("countdown");
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [showIdx, setShowIdx] = useState(-1);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seqLength = useCallback(() => round + 2, [round]);

  const startRound = useCallback(
    (r: number) => {
      const seq = randomSeq(r + 2);
      setSequence(seq);
      setUserInput([]);
      setLastCorrect(null);
      setPhase("countdown");
      setCountdown(3);
    },
    [],
  );

  useEffect(() => {
    startRound(round);
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("show");
      setShowIdx(0);
      return;
    }
    timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, countdown]);

  // Show each digit one by one
  useEffect(() => {
    if (phase !== "show") return;
    if (showIdx >= sequence.length) {
      timerRef.current = setTimeout(() => {
        setShowIdx(-1);
        setPhase("input");
      }, 400);
      return;
    }
    timerRef.current = setTimeout(() => {
      setShowIdx((i) => i + 1);
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, showIdx, sequence.length]);

  const handleDigit = (digit: number) => {
    if (phase !== "input") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const idx = userInput.length;
    const expected = sequence[idx];
    const isCorrect = digit === expected;

    if (!isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLastCorrect(false);
      setPhase("result");
      // Wrong — show result then next round or gameover
      setTimeout(() => {
        if (round >= TOTAL_ROUNDS) {
          finishGame(totalScore);
        } else {
          setRound((r) => r + 1);
          startRound(round + 1);
        }
      }, 1200);
      return;
    }

    const newInput = [...userInput, digit];
    setUserInput(newInput);

    if (newInput.length === sequence.length) {
      // Completed correctly
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const roundScore = 100 * seqLength();
      setTotalScore((s) => s + roundScore);
      setLastCorrect(true);
      setPhase("result");
      setTimeout(() => {
        if (round >= TOTAL_ROUNDS) {
          finishGame(totalScore + roundScore);
        } else {
          setRound((r) => r + 1);
          startRound(round + 1);
        }
      }, 1200);
    }
  };

  const finishGame = (finalScore: number) => {
    setTotalScore(finalScore);
    setPhase("gameover");
    addGameResult({
      gameId: "sequence",
      gameName: "Number Recall",
      score: finalScore,
    });
  };

  const restart = () => {
    setRound(1);
    setTotalScore(0);
    setUserInput([]);
    setLastCorrect(null);
    startRound(1);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Number Recall",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      />
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        {/* Round indicator */}
        <View style={styles.roundRow}>
          {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.roundDot,
                {
                  backgroundColor:
                    i < round - 1
                      ? "#10B981"
                      : i === round - 1
                        ? "#10B981"
                        : colors.border,
                  width: i === round - 1 ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.roundLabel, { color: colors.mutedForeground }]}>
          Round {round} of {TOTAL_ROUNDS} · Length: {seqLength()}
        </Text>

        {/* Display area */}
        <View
          style={[
            styles.displayArea,
            { backgroundColor: colors.card, borderRadius: colors.radius },
          ]}
        >
          {phase === "countdown" && (
            <View style={styles.center}>
              <Text
                style={[styles.countdownNum, { color: colors.primary }]}
              >
                {countdown === 0 ? "Go!" : countdown}
              </Text>
              <Text
                style={[
                  styles.countdownLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                Memorize the sequence
              </Text>
            </View>
          )}

          {phase === "show" && (
            <View style={styles.center}>
              <Text
                style={[styles.displayNum, { color: colors.foreground }]}
              >
                {showIdx >= 0 && showIdx < sequence.length
                  ? sequence[showIdx]
                  : ""}
              </Text>
              <Text
                style={[styles.displayPos, { color: colors.mutedForeground }]}
              >
                {showIdx + 1} / {sequence.length}
              </Text>
            </View>
          )}

          {phase === "input" && (
            <View style={styles.center}>
              <View style={styles.inputDisplay}>
                {sequence.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.inputSlot,
                      {
                        backgroundColor:
                          i < userInput.length
                            ? "#10B981" + "26"
                            : colors.secondary,
                        borderColor:
                          i < userInput.length ? "#10B981" : colors.border,
                        borderWidth: 1.5,
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.inputSlotNum,
                        {
                          color:
                            i < userInput.length
                              ? "#10B981"
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {i < userInput.length ? userInput[i] : "?"}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={[styles.inputHint, { color: colors.mutedForeground }]}
              >
                Tap the digits in order
              </Text>
            </View>
          )}

          {phase === "result" && (
            <View style={styles.center}>
              <Feather
                name={lastCorrect ? "check-circle" : "x-circle"}
                size={52}
                color={lastCorrect ? "#10B981" : colors.destructive}
              />
              <Text
                style={[
                  styles.resultLabel,
                  {
                    color: lastCorrect ? "#10B981" : colors.destructive,
                  },
                ]}
              >
                {lastCorrect ? "Correct!" : "Wrong!"}
              </Text>
            </View>
          )}

          {phase === "gameover" && (
            <View style={styles.center}>
              <Feather name="award" size={48} color="#10B981" />
              <Text style={[styles.goTitle, { color: colors.foreground }]}>
                Complete!
              </Text>
              <Text style={[styles.goScore, { color: "#10B981" }]}>
                {totalScore}
              </Text>
              <Text
                style={[styles.goLabel, { color: colors.mutedForeground }]}
              >
                points
              </Text>
            </View>
          )}
        </View>

        {/* Score */}
        <Text style={[styles.score, { color: colors.primary }]}>
          Score: {totalScore}
        </Text>

        {/* Number pad */}
        {phase === "input" && (
          <View style={styles.numpad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Pressable
                key={n}
                onPress={() => handleDigit(n)}
                style={({ pressed }) => [
                  styles.numKey,
                  {
                    backgroundColor: pressed ? colors.primary : colors.card,
                    borderRadius: 14,
                  },
                ]}
              >
                <Text
                  style={[styles.numKeyText, { color: colors.foreground }]}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {phase === "gameover" && (
          <View style={styles.endBtns}>
            <Pressable
              onPress={restart}
              style={[
                styles.endBtn,
                {
                  backgroundColor: "#10B981",
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={styles.endBtnText}>Play Again</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[
                styles.endBtn,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[styles.endBtnText, { color: colors.foreground }]}>
                Done
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  roundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  roundDot: { height: 8, borderRadius: 4 },
  roundLabel: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  displayArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: 200,
  },
  center: { alignItems: "center", gap: 12 },
  countdownNum: { fontSize: 72, fontFamily: "Inter_700Bold" },
  countdownLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  displayNum: { fontSize: 80, fontFamily: "Inter_700Bold" },
  displayPos: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inputDisplay: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  inputSlot: { width: 40, height: 48, alignItems: "center", justifyContent: "center" },
  inputSlotNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  inputHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultLabel: { fontSize: 24, fontFamily: "Inter_700Bold" },
  goTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  goScore: { fontSize: 60, fontFamily: "Inter_700Bold" },
  goLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  score: { textAlign: "center", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  numKey: {
    width: "30%",
    paddingVertical: 16,
    alignItems: "center",
  },
  numKeyText: { fontSize: 24, fontFamily: "Inter_700Bold" },
  endBtns: { flexDirection: "row", gap: 10 },
  endBtn: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
  },
  endBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
