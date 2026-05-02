import crypto from "node:crypto";
import type { GameItem } from "@workspace/db";

/**
 * Pure utilities for the catalogue: proficiency-band math, item selection,
 * and the weekly free-tier rotation.
 */

/** Score range is [0, 5000] split into 5 bands of 1000 each. */
export function scoreToBand(score: number): number {
  if (score <= 0) return 1;
  if (score >= 5000) return 5;
  return Math.min(5, Math.max(1, Math.floor(score / 1000) + 1));
}

/** Returns ISO-week key like "2026-W18" (UTC). */
export function getISOWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Fraction of paid games unlocked for free in any given ISO week. */
export const FREE_ROTATION_FRACTION = 0.3;

/**
 * Free-tier rotation rule (FR-4.3).
 *
 * - Permanently-free games are always free.
 * - Paid games are free when a deterministic hash of (gameId, ISO week)
 *   falls below `FREE_ROTATION_FRACTION`. ~30% of paid games per week.
 *
 * The userId parameter is reserved for future per-user trial logic; the
 * current rotation is global.
 */
export function isGameFreeForUser(
  _userId: string,
  game: { id: string; isFreeTier: boolean },
  today: Date,
): boolean {
  if (game.isFreeTier) return true;
  const weekKey = getISOWeekKey(today);
  const hash = crypto
    .createHash("sha256")
    .update(`${game.id}:${weekKey}`)
    .digest();
  // Use first 4 bytes as a uint32 normalized to [0, 1).
  const value = hash.readUInt32BE(0) / 0x1_0000_0000;
  return value < FREE_ROTATION_FRACTION;
}

export const ITEMS_PER_REQUEST = 10;
export const BAND_RADIUS = 1;

/**
 * Item selection rules:
 *  - keep only items in [userBand - 1, userBand + 1] (clamped to 1..5)
 *  - exclude any item id seen in `recentItemIds`
 *  - return up to N items
 *
 * Stable order (by item id) so the same inputs yield the same outputs —
 * the caller can still randomise client-side if desired.
 */
export function selectItemsForUser(
  items: ReadonlyArray<GameItem>,
  userScore: number,
  recentItemIds: ReadonlySet<string>,
  count: number = ITEMS_PER_REQUEST,
): GameItem[] {
  const userBand = scoreToBand(userScore);
  const allowed = new Set(
    [userBand - BAND_RADIUS, userBand, userBand + BAND_RADIUS].filter(
      (b) => b >= 1 && b <= 5,
    ),
  );

  return items
    .filter(
      (item) =>
        allowed.has(item.difficultyBand) && !recentItemIds.has(item.id),
    )
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, count);
}

/** Strip server-only fields before sending an item to the client. */
export function publicGameItem(item: GameItem): {
  id: string;
  gameId: string;
  difficultyBand: number;
  version: number;
  payload: unknown;
} {
  // The full payload (including any answer keys) is intentionally returned —
  // this is the per-game decision and most of our games are self-graded.
  // Specific games that must hide answers should be filtered here in future.
  return {
    id: item.id,
    gameId: item.gameId,
    difficultyBand: item.difficultyBand,
    version: item.version,
    payload: item.payload,
  };
}
