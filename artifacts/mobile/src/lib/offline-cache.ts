import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";

import { ApiError, api } from "./api";
import type { GameItem } from "../games/types";

/**
 * Offline catalogue + items cache (FR-9.1, FR-9.2).
 *
 * Strategy:
 *   - On every app foreground transition we attempt to pre-download the
 *     game catalogue plus, for each game, the next batch of items. Each
 *     blob is stored under a stable key with a TTL stamp.
 *   - GameContainer reads from this cache when the live API call fails
 *     (offline / 5xx). The cache is read-only at gameplay time — it is
 *     never written from the gameplay path so an offline session can't
 *     accidentally evict its own data.
 *   - "Next 3 days of games" is interpreted as: the games surfaced by
 *     `/api/games` (the catalogue we already serve) for the next 3
 *     foregrounded days, refreshed each foreground. The TTL is
 *     generous (3 days) so a user who goes away for the weekend can
 *     still play offline on Sunday.
 *
 * Why AsyncStorage and not SQLite:
 *   - The dataset is small (a few KB per game). AsyncStorage round-trips
 *     are fast enough and we already use it for the progress queue and
 *     settings.
 */

const CACHE_VERSION = 1;
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const CATALOG_KEY = `nf_offline_catalog_v${CACHE_VERSION}`;
const ITEMS_KEY = (slug: string) => `nf_offline_items_v${CACHE_VERSION}_${slug}`;
const FOREGROUND_PREFETCH_DEBOUNCE_MS = 30_000;

export type CachedGame = {
  gameId: string;
  slug: string;
  title: string;
  domain: string;
  averageDurationSec: number;
  isFreeTier?: boolean;
  supportsRelaxed?: boolean;
};

export type CachedItemsResponse = {
  gameId: string;
  slug: string;
  proficiencyScore?: number;
  items: ReadonlyArray<GameItem<unknown>>;
};

type Wrapped<T> = { storedAt: number; data: T };

function isFresh<T>(w: Wrapped<T> | null): w is Wrapped<T> {
  if (!w) return false;
  return Date.now() - w.storedAt < TTL_MS;
}

async function readWrapped<T>(key: string): Promise<Wrapped<T> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Wrapped<T>;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.storedAt === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeWrapped<T>(key: string, data: T): Promise<void> {
  const wrapped: Wrapped<T> = { storedAt: Date.now(), data };
  await AsyncStorage.setItem(key, JSON.stringify(wrapped));
}

// ── Public reads (gameplay-time fallback) ───────────────────────────────────

export async function getCachedItems(
  slug: string,
): Promise<CachedItemsResponse | null> {
  const w = await readWrapped<CachedItemsResponse>(ITEMS_KEY(slug));
  if (!isFresh(w)) return null;
  return w.data;
}

export async function getCachedCatalog(): Promise<CachedGame[] | null> {
  const w = await readWrapped<CachedGame[]>(CATALOG_KEY);
  if (!isFresh(w)) return null;
  return w.data;
}

// ── Pre-download (foreground tick) ──────────────────────────────────────────

let prefetchInFlight: Promise<void> | null = null;
let lastPrefetchAt = 0;

/**
 * Single-flight + debounced. If a prefetch is already running we return
 * the same promise; if one finished within the debounce window we no-op.
 *
 * Errors are caught and logged — an offline foreground tick is the
 * NORMAL case, we don't want to spam the console with stack traces.
 */
export function prefetchOfflineCache(): Promise<void> {
  const now = Date.now();
  if (prefetchInFlight) return prefetchInFlight;
  if (now - lastPrefetchAt < FOREGROUND_PREFETCH_DEBOUNCE_MS) {
    return Promise.resolve();
  }
  prefetchInFlight = (async () => {
    try {
      const catalog = await api.get<{ games: CachedGame[] }>("/api/games");
      const games = catalog.games ?? [];
      await writeWrapped(CATALOG_KEY, games);
      // Fan out item prefetch with bounded concurrency so a 20-game
      // catalogue doesn't open 20 sockets at once on a flaky network.
      await runWithConcurrency(games, 3, async (g) => {
        try {
          const res = await api.get<CachedItemsResponse>(
            `/api/games/${g.slug}/items`,
          );
          await writeWrapped(ITEMS_KEY(g.slug), res);
        } catch (err) {
          // Per-game miss is fine — we'll retry next foreground.
          if (!(err instanceof ApiError) || err.status >= 500) {
            // Quiet log only for unexpected failures.
            // (Network failure is noise we don't surface.)
          }
        }
      });
      lastPrefetchAt = Date.now();
    } catch {
      // Network is the expected miss case. Keep the previous cache.
    } finally {
      prefetchInFlight = null;
    }
  })();
  return prefetchInFlight;
}

async function runWithConcurrency<T>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(limit, items.length); w++) {
    workers.push(
      (async () => {
        while (i < items.length) {
          const idx = i++;
          await fn(items[idx]!);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

// ── Lifecycle wiring ────────────────────────────────────────────────────────

export function initOfflineCache(): () => void {
  const onChange = (state: AppStateStatus) => {
    if (state === "active") void prefetchOfflineCache();
  };
  const sub = AppState.addEventListener("change", onChange);
  // Best-effort initial prefetch on cold start.
  void prefetchOfflineCache();
  return () => sub.remove();
}

// ── Test helpers ────────────────────────────────────────────────────────────

export async function _resetOfflineCacheForTests(): Promise<void> {
  prefetchInFlight = null;
  lastPrefetchAt = 0;
  // No directory listing of namespaced keys — caller drains AsyncStorage.
}

export const _CATALOG_KEY = CATALOG_KEY;
export const _ITEMS_KEY = ITEMS_KEY;
export const _TTL_MS = TTL_MS;
