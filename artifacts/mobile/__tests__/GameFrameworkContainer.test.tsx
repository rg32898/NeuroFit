/**
 * GameContainer (framework) — verifies the prompt's hard requirement:
 * exactly ONE GAME_COMPLETED ProgressEvent is enqueued at the end of a
 * session, regardless of how many items were submitted (5) and how the
 * user got through them.
 *
 * We override the registry entry + items so the test is hermetic and
 * never touches the network or AsyncStorage.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { GameContainer } from "@app/games/components/GameContainer";
import * as queue from "@app/lib/progress-queue";
import type { GameDefinition, GameItem } from "@app/games/types";

// Stub the api so the (disabled) query never accidentally hits the network.
jest.mock("@app/lib/api", () => ({
  __esModule: true,
  api: {
    get: jest.fn(),
    post: jest.fn(async () => undefined),
  },
  ApiError: class ApiError extends Error {
    status = 0;
  },
  onForcedLogout: () => () => undefined,
}));

const enqueueSpy = jest
  .spyOn(queue, "enqueue")
  .mockResolvedValue({ clientEventId: "stub" } as never);

type TestPayload = { value: number };
type TestAnswer = "ok";

const TestComponent = ({
  onSubmit,
}: {
  onSubmit: (a: TestAnswer) => void;
}) => (
  <>
    {/* Single button so the test can synchronously drive submission. */}
    {/* eslint-disable-next-line react/no-children-prop */}
    <button
      // @ts-expect-error react-native-web style stand-in to keep the test minimal
      onPress={() => onSubmit("ok")}
      data-testid="answer-btn"
    >
      ok
    </button>
  </>
);

const mockItems: GameItem<TestPayload>[] = Array.from({ length: 5 }, (_, i) => ({
  id: `item-${i}`,
  gameId: "g-test",
  difficultyBand: 1,
  version: 1,
  payload: { value: i },
}));

const mockDefinition: GameDefinition<TestPayload, TestAnswer> = {
  slug: "test-game",
  title: "Test Game",
  domain: "math",
  Component: () => null, // we drive submission via the harness below
  grade: () => ({ correct: true, score: 1000, explanation: "ok" }),
};

/**
 * Harness component — rather than relying on a synthetic native button
 * (which doesn't fire reliably under jest-expo + RN Testing Library),
 * we wire our own minimal harness that just calls onSubmit when its
 * effect runs. Each new mounted instance => one submit.
 */
const HarnessDef: GameDefinition<TestPayload, TestAnswer> = {
  ...mockDefinition,
  Component: ({ onSubmit }) => {
    React.useEffect(() => {
      onSubmit("ok");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  },
};

function renderContainer(onComplete: jest.Mock) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GameContainer
        game={{
          gameId: "g-test",
          slug: "test-game",
          domain: "math",
          title: "Test Game",
          averageDurationSec: 30,
          supportsRelaxed: true,
        }}
        relaxedScale={1}
        onComplete={onComplete}
        itemsOverride={mockItems as unknown as GameItem<unknown>[]}
        definitionOverride={HarnessDef as unknown as GameDefinition<unknown, unknown>}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  enqueueSpy.mockClear();
});

it("enqueues exactly ONE GAME_COMPLETED event after 5 item submissions", async () => {
  const onComplete = jest.fn();
  renderContainer(onComplete);

  // For each of the 5 items: the harness component auto-submits in its
  // first effect → FeedbackPanel renders → tap Continue → next item
  // mounts → effect fires again → ... after the 5th Continue, finish().
  for (let i = 0; i < 5; i++) {
    // Wait for the FeedbackPanel's Continue button to appear.
    // eslint-disable-next-line no-await-in-loop
    await waitFor(() =>
      expect(screen.queryByLabelText("feedback.continue")).toBeTruthy(),
    );
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      fireEvent.press(screen.getByLabelText("feedback.continue"));
    });
  }

  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith(100);

  expect(enqueueSpy).toHaveBeenCalledTimes(1);
  const arg = enqueueSpy.mock.calls[0][0];
  expect(arg.eventType).toBe("game_completed");
  expect(arg.gameId).toBe("g-test");
  expect(arg.score).toBe(100);
  expect(
    (arg.payload as { items: Array<{ itemId: string }> }).items,
  ).toHaveLength(5);
});

it("does not double-fire when the user mashes Continue", async () => {
  const onComplete = jest.fn();
  renderContainer(onComplete);

  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await waitFor(() =>
      expect(screen.queryByLabelText("feedback.continue")).toBeTruthy(),
    );
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      const btn = screen.getByLabelText("feedback.continue");
      // Two presses in the same tick — the sync `completed` ref must
      // prevent a second finish() from running.
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
  }

  expect(enqueueSpy).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledTimes(1);
});
