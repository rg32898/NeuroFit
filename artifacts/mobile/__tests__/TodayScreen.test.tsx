/**
 * TodayScreen — verifies that a successful /workout/today response renders
 * one card per planned game (3 in this fixture).
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";

import { TodayScreen } from "@app/screens/today/TodayScreen";
import type {
  PlannedGame,
  StreakResponse,
  WorkoutTodayResponse,
} from "@app/lib/workout-api";

const planned: PlannedGame[] = [
  {
    gameId: "g_memory_dual",
    slug: "dual-n-back",
    domain: "memory",
    title: "Dual N-Back",
    averageDurationSec: 180,
    supportsRelaxed: true,
  },
  {
    gameId: "g_attention_react",
    slug: "reaction-time",
    domain: "attention",
    title: "Reaction Time",
    averageDurationSec: 90,
    supportsRelaxed: false,
  },
  {
    gameId: "g_logic_seq",
    slug: "sequence-logic",
    domain: "logic",
    title: "Sequence Logic",
    averageDurationSec: 240,
    supportsRelaxed: true,
  },
];

const workout: WorkoutTodayResponse = {
  session: {
    id: "wk_2026_05_03",
    date: "2026-05-03",
    completedAt: null,
    gamesPlanned: planned,
    estimatedDurationSec: planned.reduce((s, g) => s + g.averageDurationSec, 0),
  },
  created: false,
};

const streak: StreakResponse = {
  current: 7,
  longest: 21,
  lastActiveDate: "2026-05-02",
  freezesAvailable: 2,
};

describe("TodayScreen", () => {
  it("renders one card per planned game", () => {
    render(
      <TodayScreen
        workout={workout}
        streak={streak}
        loading={false}
        error={null}
        relaxedScale={1}
        onStartWorkout={jest.fn()}
        onOpenRelaxedPicker={jest.fn()}
        onFreePlay={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    // One title per planned game.
    expect(screen.getByText("Dual N-Back")).toBeTruthy();
    expect(screen.getByText("Reaction Time")).toBeTruthy();
    expect(screen.getByText("Sequence Logic")).toBeTruthy();

    // The "Start workout" CTA is present and active.
    expect(screen.getByText("today.startCta")).toBeTruthy();

    // Streak surfaces in the header card.
    expect(screen.getByText("7")).toBeTruthy();
  });
});
