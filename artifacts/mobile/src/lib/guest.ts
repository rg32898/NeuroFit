import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, ApiError } from "./api";

/**
 * Guest mode + pending-event queue.
 *
 * Goals (FR-1.x):
 *  - Let a brand-new user reach the first workout without an account
 *    (FR-1.1, FR-1.5: no paywall, no forced sign-up before session 3).
 *  - Persist a stable local userId so guest progress survives an app
 *    restart (NFR-6.1).
 *  - When the user later signs up, replay any actions that were queued
 *    while they were a guest so progress is not lost.
 *
 * Storage backend mirrors `tokenStorage.ts`: SecureStore on native,
 * localStorage on web. Keys are `nf_guest_*` to namespace cleanly.
 */

const GUEST_ID_KEY = "nf_guest_id";
const ONBOARDED_KEY = "nf_onboarded";
const PENDING_EVENTS_KEY = "nf_pending_events";

const isWeb = Platform.OS === "web";

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/** Generate a v4-ish UUID without pulling in a runtime dep. */
function makeId(): string {
  // crypto.randomUUID is available in modern RN (Hermes 0.74+) and on web.
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback: not cryptographically perfect but unique enough for a local id.
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOrCreateGuestId(): Promise<string> {
  const existing = await getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = makeId();
  await setItem(GUEST_ID_KEY, id);
  return id;
}

export async function getGuestId(): Promise<string | null> {
  return getItem(GUEST_ID_KEY);
}

export async function isOnboarded(): Promise<boolean> {
  return (await getItem(ONBOARDED_KEY)) === "1";
}

export async function setOnboarded(value: boolean): Promise<void> {
  if (value) await setItem(ONBOARDED_KEY, "1");
  else await deleteItem(ONBOARDED_KEY);
}

// ── Pending events queue ─────────────────────────────────────────────────────
//
// While the user is a guest, server-state actions (assessment submission,
// progress events) are queued instead of POSTed. On sign-up / sign-in we
// replay them in order. Each event is a `{ method, path, body }` triple so
// the queue is generic and forward-compatible — adding a new endpoint to
// the offline path requires no changes here.

export type PendingEvent = {
  /** Stable id used for de-dup and ordering. */
  id: string;
  method: "POST" | "PUT" | "PATCH";
  path: string;
  body: unknown;
  /** ms since epoch — preserved across replay so server can timestamp. */
  createdAt: number;
};

export async function getPendingEvents(): Promise<PendingEvent[]> {
  const raw = await getItem(PENDING_EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePendingEvents(events: PendingEvent[]): Promise<void> {
  if (events.length === 0) {
    await deleteItem(PENDING_EVENTS_KEY);
    return;
  }
  await setItem(PENDING_EVENTS_KEY, JSON.stringify(events));
}

/**
 * NOTE on concurrency: this is a read-modify-write against storage. In the
 * current onboarding flow there is at most one producer at a time (the
 * assessment screen), so lost-update is not a concern. If/when we start
 * queueing progress events from multiple screens concurrently, wrap this
 * in a single-flight mutex (e.g. a module-level Promise chain) before
 * shipping — the API surface here will not need to change.
 */
let appendChain: Promise<unknown> = Promise.resolve();
export async function appendPendingEvent(
  ev: Omit<PendingEvent, "id" | "createdAt">,
): Promise<PendingEvent> {
  // Serialise all appends through a single in-memory promise chain so even
  // a future multi-producer caller can't drop events. This is process-local
  // (not cross-process), which is fine for a mobile client.
  const next = appendChain.then(async (): Promise<PendingEvent> => {
    const events = await getPendingEvents();
    const full: PendingEvent = {
      ...ev,
      id: makeId(),
      createdAt: Date.now(),
    };
    events.push(full);
    await writePendingEvents(events);
    return full;
  });
  // Keep the chain alive even on rejection so subsequent callers continue.
  appendChain = next.catch(() => undefined);
  return next;
}

export async function clearPendingEvents(): Promise<void> {
  await deleteItem(PENDING_EVENTS_KEY);
}

/**
 * Replay any pending events as the now-authenticated user, then wipe the
 * guest data. Best-effort: a 4xx on a single event drops it (the request
 * was structurally bad and would never succeed); a 5xx leaves it in the
 * queue so we can retry next foreground.
 *
 * Caller must already be authenticated when this runs (auth-store calls
 * it after login/register success).
 */
export async function promoteGuestToAccount(): Promise<{
  replayed: number;
  failed: number;
}> {
  const events = await getPendingEvents();
  if (events.length === 0) {
    await deleteItem(GUEST_ID_KEY);
    return { replayed: 0, failed: 0 };
  }

  const remaining: PendingEvent[] = [];
  let replayed = 0;
  let failed = 0;

  for (const ev of events) {
    try {
      if (ev.method === "POST") await api.post(ev.path, ev.body);
      else if (ev.method === "PUT") await api.put(ev.path, ev.body);
      else await api.patch(ev.path, ev.body);
      replayed += 1;
    } catch (err) {
      // 4xx → permanent failure for this event; drop. 5xx / network → keep.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        failed += 1;
        continue;
      }
      remaining.push(ev);
      failed += 1;
    }
  }

  await writePendingEvents(remaining);
  if (remaining.length === 0) await deleteItem(GUEST_ID_KEY);

  return { replayed, failed };
}

/**
 * Reset everything (used on full logout). Keeps API surface symmetric.
 */
export async function clearGuestData(): Promise<void> {
  await Promise.all([
    deleteItem(GUEST_ID_KEY),
    deleteItem(PENDING_EVENTS_KEY),
    deleteItem(ONBOARDED_KEY),
  ]);
}
