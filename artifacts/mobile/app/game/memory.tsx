import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type CardState = "hidden" | "flipped" | "matched";

interface Card {
  id: number;
  value: number;
  state: CardState;
}

const SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const SYMBOL_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
  "#EF4444",
  "#F97316",
];

function createDeck(pairs: number): Card[] {
  const vals = Array.from({ length: pairs }, (_, i) => i);
  const doubled = [...vals, ...vals];
  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j] as number, doubled[i] as number];
  }
  return doubled.map((value, id) => ({ id, value, state: "hidden" }));
}

export default function MemoryGame() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addGameResult, completeDailyChallenge } = useApp();

  const pairs = 8;
  const [cards, setCards] = useState<Card[]>(() => createDeck(pairs));
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const checkWin = useCallback(
    (updatedCards: Card[]) => {
      if (updatedCards.every((c) => c.state === "matched")) {
        if (timerRef.current) clearInterval(timerRef.current);
        const finalScore = Math.max(
          100,
          1000 - moves * 15 - Math.floor(seconds / 5) * 10,
        );
        setScore(finalScore);
        setGameOver(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addGameResult({ gameId: "memory", gameName: "Memory Match", score: finalScore });
        completeDailyChallenge();
      }
    },
    [moves, seconds, addGameResult, completeDailyChallenge],
  );

  const handleCardPress = useCallback(
    (cardId: number) => {
      if (lockRef.current || gameOver) return;
      const card = cards[cardId];
      if (!card || card.state !== "hidden") return;
      if (flippedIds.includes(cardId)) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newFlipped = [...flippedIds, cardId];
      const updatedCards = cards.map((c) =>
        c.id === cardId ? { ...c, state: "flipped" as CardState } : c,
      );
      setCards(updatedCards);
      setFlippedIds(newFlipped);

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        lockRef.current = true;
        const [firstId, secondId] = newFlipped as [number, number];
        const first = updatedCards[firstId];
        const second = updatedCards[secondId];

        if (first && second && first.value === second.value) {
          const matched = updatedCards.map((c) =>
            c.id === firstId || c.id === secondId
              ? { ...c, state: "matched" as CardState }
              : c,
          );
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setCards(matched);
          setFlippedIds([]);
          lockRef.current = false;
          checkWin(matched);
        } else {
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, state: "hidden" as CardState }
                  : c,
              ),
            );
            setFlippedIds([]);
            lockRef.current = false;
          }, 900);
        }
      }
    },
    [cards, flippedIds, gameOver, checkWin],
  );

  const restart = () => {
    setCards(createDeck(pairs));
    setFlippedIds([]);
    setMoves(0);
    setSeconds(0);
    setGameOver(false);
    setScore(0);
    lockRef.current = false;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const cols = 4;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Memory Match",
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        scrollEnabled={false}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View
            style={[styles.statBox, { backgroundColor: colors.card, borderRadius: 12 }]}
          >
            <Feather name="move" size={14} color={colors.primary} />
            <Text style={[styles.statNum, { color: colors.foreground }]}>
              {moves}
            </Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
              Moves
            </Text>
          </View>
          <View style={styles.pairsInfo}>
            <Text style={[styles.pairsText, { color: colors.foreground }]}>
              {cards.filter((c) => c.state === "matched").length / 2}/{pairs}
            </Text>
            <Text
              style={[styles.pairsLabel, { color: colors.mutedForeground }]}
            >
              pairs found
            </Text>
          </View>
          <View
            style={[styles.statBox, { backgroundColor: colors.card, borderRadius: 12 }]}
          >
            <Feather name="clock" size={14} color="#F59E0B" />
            <Text style={[styles.statNum, { color: colors.foreground }]}>
              {seconds}s
            </Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>
              Time
            </Text>
          </View>
        </View>

        {/* Card grid */}
        <View style={styles.grid}>
          {cards.map((card) => {
            const isFlipped =
              card.state === "flipped" || card.state === "matched";
            const isMatched = card.state === "matched";
            const symColor = SYMBOL_COLORS[card.value % SYMBOL_COLORS.length] as string;

            return (
              <Pressable
                key={card.id}
                onPress={() => handleCardPress(card.id)}
                style={[
                  styles.card,
                  {
                    backgroundColor: isFlipped
                      ? isMatched
                        ? symColor + "22"
                        : colors.card
                      : colors.secondary,
                    borderRadius: 10,
                    borderWidth: isMatched ? 1.5 : 0,
                    borderColor: isMatched ? symColor : "transparent",
                    width: `${100 / cols - 2}%`,
                  },
                ]}
              >
                {isFlipped ? (
                  <>
                    <Text
                      style={[
                        styles.cardSymbol,
                        { color: isMatched ? symColor : colors.foreground },
                      ]}
                    >
                      {SYMBOLS[card.value % SYMBOLS.length]}
                    </Text>
                    {isMatched && (
                      <Feather name="check" size={10} color={symColor} />
                    )}
                  </>
                ) : (
                  <Feather name="help-circle" size={20} color={colors.mutedForeground} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Game over overlay */}
        {gameOver && (
          <View
            style={[
              styles.overlay,
              {
                backgroundColor: colors.background + "F0",
              },
            ]}
          >
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="check-circle" size={48} color="#10B981" />
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                Complete!
              </Text>
              <Text style={[styles.resultScore, { color: colors.primary }]}>
                {score}
              </Text>
              <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                points
              </Text>
              <View style={styles.resultMeta}>
                <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>
                  {moves} moves
                </Text>
                <Text style={[styles.metaDot, { color: colors.border }]}>
                  •
                </Text>
                <Text style={[styles.metaItem, { color: colors.mutedForeground }]}>
                  {seconds}s
                </Text>
              </View>
              <View style={styles.resultBtns}>
                <Pressable
                  onPress={restart}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={styles.btnText}>Play Again</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.back()}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: colors.secondary,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={[styles.btnText, { color: colors.foreground }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  statBox: {
    alignItems: "center",
    padding: 12,
    gap: 3,
    minWidth: 72,
  },
  statNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  pairsInfo: { flex: 1, alignItems: "center" },
  pairsText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pairsLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  card: {
    aspectRatio: 0.8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cardSymbol: { fontSize: 26, fontFamily: "Inter_700Bold" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  resultCard: {
    padding: 32,
    alignItems: "center",
    gap: 8,
    width: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  resultTitle: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 8 },
  resultScore: { fontSize: 56, fontFamily: "Inter_700Bold" },
  resultLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -4 },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  metaItem: { fontSize: 13, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 13 },
  resultBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { paddingHorizontal: 24, paddingVertical: 13 },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
