/**
 * FR-9.x — offline mid-workout completes; reconnect drains the queue
 * with no duplicates server-side (idempotent on clientEventId).
 *
 * The progress queue's flush() target is the single `api.post` call.
 * We mock it so the first attempt simulates "offline" (network error),
 * the queue is preserved, and a subsequent flush after we restore the
 * mock posts the SAME clientEventId — proving duplicates would be
 * de-duped by the server which keys on (userId, clientEventId).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../src/lib/api", () => {
  const ApiError = class extends Error {
    status: number;
    code: string;
    constructor(status: number, body: { code: string; message: string }) {
      super(body.message);
      this.status = status;
      this.code = body.code;
    }
  };
  return {
    __esModule: true,
    ApiError,
    api: { post: jest.fn() },
    onForcedLogout: jest.fn(() => () => undefined),
  };
});

import { api } from "../src/lib/api";
import {
  _peekQueueForTests,
  _resetForTests,
  enqueue,
  flush,
} from "../src/lib/progress-queue";

const mockedPost = api.post as jest.MockedFunction<typeof api.post>;

beforeEach(async () => {
  await _resetForTests();
  await AsyncStorage.clear();
  mockedPost.mockReset();
});

describe("offline mid-workout → reconnect drains queue", () => {
  it("preserves the event when offline and replays the same clientEventId on reconnect", async () => {
    // 1) Simulate airplane mode: post throws a network error.
    mockedPost.mockRejectedValueOnce(new Error("Network request failed"));

    const stableId = "evt-stable-1";
    await enqueue({
      clientEventId: stableId,
      eventType: "game_completed",
      gameId: "game-1",
      score: 80,
    });

    // First flush attempt fires from inside enqueue; await microtasks.
    await new Promise((r) => setTimeout(r, 0));

    // The event must still be in the queue — losing it would be data loss.
    const stillQueued = await _peekQueueForTests();
    expect(stillQueued.length).toBe(1);
    expect(stillQueued[0]!.clientEventId).toBe(stableId);

    // 2) Reconnect: the next post succeeds.
    mockedPost.mockResolvedValueOnce(undefined as never);

    await flush();

    // Server received the SAME clientEventId — no last-write-wins, no
    // mutation. Server merges by clientEventId per FR-9.3.
    expect(mockedPost).toHaveBeenLastCalledWith("/api/progress/events", {
      events: [
        expect.objectContaining({
          clientEventId: stableId,
          eventType: "game_completed",
          gameId: "game-1",
          score: 80,
        }),
      ],
    });

    // Queue is empty after the successful flush.
    const drained = await _peekQueueForTests();
    expect(drained.length).toBe(0);
  });

  it("does not duplicate events when flush is called twice during reconnect", async () => {
    mockedPost.mockResolvedValue(undefined as never);

    const id = "evt-no-dup";
    await enqueue({
      clientEventId: id,
      eventType: "game_completed",
      gameId: "g",
      score: 50,
    });
    await new Promise((r) => setTimeout(r, 0));

    // Hammer flush — single-flight guard + per-clientEventId removal must
    // mean the server only ever sees one POST containing this event.
    await Promise.all([flush(), flush(), flush()]);

    const callsWithThisId = mockedPost.mock.calls.filter((call) => {
      const body = call[1] as { events: Array<{ clientEventId: string }> };
      return body.events.some((e) => e.clientEventId === id);
    });
    expect(callsWithThisId.length).toBe(1);

    const drained = await _peekQueueForTests();
    expect(drained.length).toBe(0);
  });
});
