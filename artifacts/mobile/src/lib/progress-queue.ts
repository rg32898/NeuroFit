import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError, api, onForcedLogout } from "./api";
import { uuidv4 } from "./uuid";

/**
 * Local-first ProgressEvent queue.
 *
 * Why this exists:
 *   - The user expects to finish a game and immediately move on. We must
 *     not block the UI waiting for the network.
 *   - Mobile networks fail intermittently. We never lose an event.
 *   - The server enforces idempotency on (userId, clientEventId). So as
 *     long as we stamp every event with a stable UUID and resend on retry,
 *     duplicates are de-duped server-side.
 *
 * Lifecycle:
 *   - `enqueue()` writes to AsyncStorage and triggers a fire-and-forget
 *     flush. The caller does not await network I/O.
 *   - `flush()` sends a single batch (up to MAX_BATCH) to /api/progress/events.
 *     On success the flushed events are removed; on 5xx/network the queue
 *     is left intact and a backoff retry is scheduled.
 *   - `initProgressQueue()` wires AppState so a foreground transition
 *     triggers a flush — the typical "I lost connectivity at the gym, I'm
 *     home now and the app comes to the front" path.
 *
 * NOT included on purpose:
 *   - Cross-process locking. AsyncStorage is single-process.
 *   - End-to-end encryption — events contain only gameplay scores, no PII.
 */

const STORAGE_KEY = "nf_progress_queue";
const MAX_BATCH = 50;
// Capped exponential backoff. The last value is the steady-state retry
// cadence for an extended outage so we don't peg the network.
const BACKOFF_MS = [500, 1500, 5000, 15_000, 60_000];

export type QueuedEvent = {
  clientEventId: string;
  eventType: string;
  sessionId?: string;
  gameId?: string;
  itemId?: string;
  score?: number;
  durationMs?: number;
  occurredAt?: string;
  payload?: unknown;
};

export type EnqueueInput = Omit<QueuedEvent, "clientEventId" | "occurredAt"> & {
  /** Override only in tests to make events deterministic. */
  clientEventId?: string;
  occurredAt?: string;
};

// ── Storage IO ──────────────────────────────────────────────────────────────
//
// All read-modify-write goes through the `mutex` chain so concurrent enqueues
// from different screens cannot lose events.

let mutex: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutex.then(fn, fn);
  mutex = next.catch(() => undefined);
  return next;
}

async function readQueue(): Promise<QueuedEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted blob — drop rather than wedge the queue forever.
    return [];
  }
}

async function writeQueue(events: QueuedEvent[]): Promise<void> {
  if (events.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function enqueue(input: EnqueueInput): Promise<QueuedEvent> {
  const full: QueuedEvent = {
    clientEventId: input.clientEventId ?? uuidv4(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    eventType: input.eventType,
    sessionId: input.sessionId,
    gameId: input.gameId,
    itemId: input.itemId,
    score: input.score,
    durationMs: input.durationMs,
    payload: input.payload,
  };
  await withLock(async () => {
    const queue = await readQueue();
    queue.push(full);
    await writeQueue(queue);
  });
  // Trigger a flush WITHOUT awaiting — caller stays unblocked.
  void flush();
  return full;
}

let flushing = false;
let attempt = 0;
let retryHandle: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry(ms: number): void {
  if (retryHandle) clearTimeout(retryHandle);
  retryHandle = setTimeout(() => {
    retryHandle = null;
    void flush();
  }, ms);
}

/**
 * True for HTTP statuses worth retrying (5xx + network-ish 4xx).
 *
 * 401 is INTENTIONALLY non-retryable: queued events were authored under
 * the previous session's identity. Re-sending them after a token refresh
 * (or worse, after a different user signs in) would cross-attribute the
 * data. Logout/forced-logout wipes the queue separately so unsent events
 * are dropped at the right moment.
 */
function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true; // network / unknown
  const s = err.status;
  if (s >= 500) return true;
  return s === 408 || s === 429;
}

export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    // Loop so that if a single batch succeeds we immediately try the next
    // one, draining the queue in one wake-up.
    // Hard upper bound prevents a runaway loop if writeQueue mis-behaves.
    for (let i = 0; i < 100; i++) {
      const queue = await readQueue();
      if (queue.length === 0) {
        attempt = 0;
        return;
      }
      const batch = queue.slice(0, MAX_BATCH);
      try {
        await api.post("/api/progress/events", { events: batch });
        await withLock(async () => {
          const current = await readQueue();
          // Remove only the events we actually sent (by clientEventId) — the
          // queue may have grown since we read it.
          const sent = new Set(batch.map((e) => e.clientEventId));
          await writeQueue(current.filter((e) => !sent.has(e.clientEventId)));
        });
        attempt = 0;
      } catch (err) {
        if (!isRetryable(err)) {
          // Permanent failure — drop the batch so it doesn't block forever.
          // We log so a misconfigured payload becomes visible in dev.
          console.warn(
            "progress-queue.drop_batch",
            err instanceof ApiError ? { status: err.status, code: err.code } : err,
          );
          await withLock(async () => {
            const current = await readQueue();
            const dropped = new Set(batch.map((e) => e.clientEventId));
            await writeQueue(
              current.filter((e) => !dropped.has(e.clientEventId)),
            );
          });
          continue;
        }
        // Transient — back off and bail out of the loop. The next foreground
        // / next enqueue / scheduled retry will pick it up.
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt = Math.min(attempt + 1, BACKOFF_MS.length - 1);
        scheduleRetry(delay);
        return;
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Wipe the entire pending queue. Called on logout (both clean and forced)
 * so events authored under the previous account never bleed into the
 * next session.
 */
export async function clearProgressQueue(): Promise<void> {
  if (retryHandle) {
    clearTimeout(retryHandle);
    retryHandle = null;
  }
  attempt = 0;
  await withLock(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  });
}

/**
 * Initialise the foreground-flush listener AND wire a forced-logout
 * subscription so the queue is wiped if the refresh-token flow fails.
 * Returns a teardown function so the root layout can clean up.
 */
export function initProgressQueue(): () => void {
  const onChange = (state: AppStateStatus) => {
    if (state === "active") void flush();
  };
  const sub = AppState.addEventListener("change", onChange);
  const unsubLogout = onForcedLogout(() => {
    void clearProgressQueue();
  });
  // Drain anything left over from the previous session.
  void flush();
  return () => {
    sub.remove();
    unsubLogout();
  };
}

// ── Test / debug helpers ────────────────────────────────────────────────────
// Not exported from the public barrel; tests import them directly.

export async function _peekQueueForTests(): Promise<QueuedEvent[]> {
  return readQueue();
}

export async function _resetForTests(): Promise<void> {
  if (retryHandle) {
    clearTimeout(retryHandle);
    retryHandle = null;
  }
  flushing = false;
  attempt = 0;
  mutex = Promise.resolve();
  await AsyncStorage.removeItem(STORAGE_KEY);
}
