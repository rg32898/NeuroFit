/**
 * WorkoutRunnerScreen — covers the two behaviours the architect review
 * called out as critical:
 *
 *   1. "Skip this game" advances to the next game without aborting the
 *      workout (FR-3.4). It also must NOT record a result for the
 *      skipped game.
 *   2. Completing all games triggers `onWorkoutComplete` exactly once,
 *      even if the user mashes the simulate-finish button.
 *
 * GameContainer is mocked so the test drives game-completion synchronously
 * instead of going through the placeholder UI.
 */
import React from "react";
import { fireEvent, render, screen, act } from "@testing-library/react-native";

import type {
  PlannedGame,
  WorkoutCompleteResponse,
} from "@app/lib/workout-api";

// Captures the latest props handed to GameContainer so tests can drive
// onComplete from outside.
const mockGameProps: {
  current: { onComplete: (score: number) => void; gameId: string } | null;
} = { current: null };

jest.mock("@app/components/GameContainer", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    __esModule: true,
    GameContainer: (props: {
      game: { gameId: string; title: string };
      onComplete: (score: number) => void;
    }) => {
      mockGameProps.current = {
        onComplete: props.onComplete,
        gameId: props.game.gameId,
      };
      return <Text testID="current-game-title">{props.game.title}</Text>;
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  WorkoutRunnerScreen,
} = require("@app/screens/workout/WorkoutRunnerScreen");

const planned: PlannedGame[] = [
  {
    gameId: "g1",
    slug: "g1",
    domain: "memory",
    title: "Game One",
    averageDurationSec: 60,
    supportsRelaxed: true,
  },
  {
    gameId: "g2",
    slug: "g2",
    domain: "attention",
    title: "Game Two",
    averageDurationSec: 60,
    supportsRelaxed: true,
  },
  {
    gameId: "g3",
    slug: "g3",
    domain: "logic",
    title: "Game Three",
    averageDurationSec: 60,
    supportsRelaxed: true,
  },
];

const completeResponse: WorkoutCompleteResponse = {
  sessionId: "wk_test",
  completed: true,
  streak: { current: 5, longest: 12, lastActiveDate: "2026-05-03" },
  proficiencyDeltas: [
    { domain: "memory", decision: "advance", delta: 1, score: 73 },
  ],
};

function renderRunner(overrides: {
  onGameComplete?: jest.Mock;
  onWorkoutComplete?: jest.Mock;
  onAfterComplete?: jest.Mock;
}) {
  const onGameComplete = overrides.onGameComplete ?? jest.fn(async () => undefined);
  const onWorkoutComplete =
    overrides.onWorkoutComplete ??
    jest.fn(async () => completeResponse);
  const onAfterComplete = overrides.onAfterComplete ?? jest.fn();
  const utils = render(
    <WorkoutRunnerScreen
      workoutId="wk_test"
      games={planned}
      initialIndex={0}
      initialResults={[]}
      relaxedScale={1}
      onGameComplete={onGameComplete}
      onWorkoutComplete={onWorkoutComplete}
      onAfterComplete={onAfterComplete}
    />,
  );
  return { ...utils, onGameComplete, onWorkoutComplete, onAfterComplete };
}

describe("WorkoutRunnerScreen", () => {
  beforeEach(() => {
    mockGameProps.current = null;
  });

  it("'Skip this game' advances to the next game without aborting", async () => {
    const { onGameComplete, onWorkoutComplete } = renderRunner({});

    // Start on game 1.
    expect(screen.getByTestId("current-game-title").props.children).toBe(
      "Game One",
    );
    expect(mockGameProps.current?.gameId).toBe("g1");

    // Tap Skip.
    await act(async () => {
      fireEvent.press(screen.getByText("runner.skip"));
    });

    // Now on game 2; runner is still mounted (workout NOT aborted).
    expect(screen.getByTestId("current-game-title").props.children).toBe(
      "Game Two",
    );
    expect(mockGameProps.current?.gameId).toBe("g2");

    // Skipping must NOT record a result and must NOT call complete yet.
    expect(onGameComplete).not.toHaveBeenCalled();
    expect(onWorkoutComplete).not.toHaveBeenCalled();
  });

  it("completing all games fires onWorkoutComplete exactly once", async () => {
    const { onGameComplete, onWorkoutComplete, onAfterComplete } = renderRunner(
      {},
    );

    // Finish game 1.
    await act(async () => {
      mockGameProps.current!.onComplete(80);
    });
    expect(onGameComplete).toHaveBeenCalledWith("g1", 80);

    // Finish game 2.
    await act(async () => {
      mockGameProps.current!.onComplete(70);
    });
    expect(onGameComplete).toHaveBeenCalledWith("g2", 70);

    // Finish game 3 — this should trigger workout completion.
    await act(async () => {
      mockGameProps.current!.onComplete(90);
    });

    expect(onGameComplete).toHaveBeenCalledTimes(3);
    expect(onWorkoutComplete).toHaveBeenCalledTimes(1);
    expect(onWorkoutComplete).toHaveBeenCalledWith([
      { gameId: "g1", score: 80 },
      { gameId: "g2", score: 70 },
      { gameId: "g3", score: 90 },
    ]);
    expect(onAfterComplete).toHaveBeenCalledTimes(1);
    expect(onAfterComplete).toHaveBeenCalledWith(completeResponse);

    // Even if the (now-stale) GameContainer ref tries to fire again, the
    // runner's submitting / submitted guard must prevent a second call.
    await act(async () => {
      mockGameProps.current?.onComplete(100);
    });
    expect(onWorkoutComplete).toHaveBeenCalledTimes(1);
  });

  it("rapid double-tap on final game still fires onWorkoutComplete only once", async () => {
    // Simulate a slow network so the second tap arrives WHILE the first
    // call is in flight. With state-based guards both calls would observe
    // submitting===false and double-fire. Sync ref guards prevent it.
    let resolveComplete: (v: WorkoutCompleteResponse) => void = () => undefined;
    const slowComplete = jest.fn(
      () =>
        new Promise<WorkoutCompleteResponse>((resolve) => {
          resolveComplete = resolve;
        }),
    );

    const { onWorkoutComplete } = renderRunner({
      onWorkoutComplete: slowComplete,
    });

    // Walk to game 3 by completing the first two synchronously.
    await act(async () => {
      mockGameProps.current!.onComplete(80);
    });
    await act(async () => {
      mockGameProps.current!.onComplete(70);
    });

    // Two BACK-TO-BACK finishes on game 3 in the same tick — this is the
    // race we're guarding against.
    await act(async () => {
      mockGameProps.current!.onComplete(90);
      mockGameProps.current!.onComplete(95);
    });

    // Resolve the in-flight completion so the test can observe the final
    // call count without timing out.
    await act(async () => {
      resolveComplete(completeResponse);
    });

    expect(onWorkoutComplete).toHaveBeenCalledTimes(1);
    // The first finish wins — second result must NOT be in the payload.
    expect(onWorkoutComplete).toHaveBeenCalledWith([
      { gameId: "g1", score: 80 },
      { gameId: "g2", score: 70 },
      { gameId: "g3", score: 90 },
    ]);
  });
});
