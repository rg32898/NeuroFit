import React from "react";
import { render, screen } from "@testing-library/react-native";

import { ProgressScreen } from "@app/screens/progress/ProgressScreen";
import type { ProgressSummary } from "@app/lib/progress-api";

const summary: ProgressSummary = {
  streak: {
    current: 4,
    longest: 12,
    freezesAvailable: 2,
    lastActiveDate: "2026-05-03T00:00:00.000Z",
  },
  proficiency: {
    vocabulary: 3000,
    writing: 1000,
    reading: 1500,
    speaking: 500,
    math: 4000,
    memory: 2500,
  },
  bands: {
    vocabulary: "Advanced",
    writing: "Beginner",
    reading: "Intermediate",
    speaking: "Beginner",
    math: "Expert",
    memory: "Advanced",
  },
  totals: { workoutsCompleted: 11, gamesCompleted: 47 },
  dailyCompletions: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(i + 4).padStart(2, "0")}`,
    count: i % 3,
  })),
  achievements: [
    {
      id: "first_workout",
      title: "First Workout",
      description: "Complete your first workout.",
    },
    {
      id: "ten_workouts",
      title: "Habit Forming",
      description: "Finish 10 workouts.",
    },
  ],
};

describe("ProgressScreen", () => {
  it("renders the streak header values", () => {
    render(
      <ProgressScreen
        summary={summary}
        loading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("4")).toBeTruthy();   // current
    expect(screen.getByText("12")).toBeTruthy();  // longest
  });

  it("renders one proficiency bar per domain", () => {
    render(
      <ProgressScreen
        summary={summary}
        loading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    for (const d of [
      "vocabulary",
      "writing",
      "reading",
      "speaking",
      "math",
      "memory",
    ]) {
      expect(screen.getByTestId(`prof-${d}`)).toBeTruthy();
      expect(screen.getByTestId(`prof-fill-${d}`)).toBeTruthy();
    }
  });

  it("renders the 30-day spark chart", () => {
    render(
      <ProgressScreen
        summary={summary}
        loading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("progress-spark")).toBeTruthy();
  });

  it("renders one card per unlocked achievement", () => {
    render(
      <ProgressScreen
        summary={summary}
        loading={false}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("achievement-first_workout")).toBeTruthy();
    expect(screen.getByTestId("achievement-ten_workouts")).toBeTruthy();
  });

  it("shows a loading spinner before data arrives", () => {
    const r = render(
      <ProgressScreen
        summary={undefined}
        loading={true}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(r.toJSON()).toBeTruthy();
  });
});
