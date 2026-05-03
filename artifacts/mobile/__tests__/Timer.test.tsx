/**
 * Timer tests — covers the two behaviours the prompt calls out:
 *
 *   1. At 100% (1.0×) scale the countdown ticks down and fires `onExpire`
 *      exactly once when it reaches 0.
 *   2. At 200% (2.0×, "off") scale the countdown is disabled and
 *      `onExpire` is never called regardless of how much wall-clock time
 *      passes.
 *
 * We use jest fake timers so we can advance time deterministically without
 * actually waiting. queueMicrotask in Timer.tsx fires onExpire on the
 * next microtask tick, so we flush microtasks after advancing.
 */
import React from "react";
import { act, render } from "@testing-library/react-native";

import { Timer } from "@app/games/components/Timer";

describe("Timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const flushMicrotasks = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  it("fires onExpire exactly once when the countdown reaches 0 at 1.0× scale", async () => {
    const onExpire = jest.fn();

    render(<Timer seconds={3} scale={1} onExpire={onExpire} />);

    // 3 seconds × 1.0× = 3 ticks. Walking past the budget should still
    // only fire onExpire once.
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await flushMicrotasks();

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("never fires onExpire at 2.0× (off) scale", async () => {
    const onExpire = jest.fn();

    render(<Timer seconds={3} scale={2} onExpire={onExpire} />);

    // Walk well past any reasonable budget — the timer must stay quiet.
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await flushMicrotasks();

    expect(onExpire).not.toHaveBeenCalled();
  });

  it("does not tick while paused", async () => {
    const onExpire = jest.fn();

    render(<Timer seconds={2} scale={1} paused onExpire={onExpire} />);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();

    expect(onExpire).not.toHaveBeenCalled();
  });
});
