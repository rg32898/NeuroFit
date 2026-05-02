import type { Game } from "@workspace/db";
import { DOMAINS, type Domain } from "@workspace/shared/profile";
import {
  WORKOUT_MAX_GAMES,
  WORKOUT_MIN_GAMES,
  WORKOUT_TARGET_DURATION_SEC,
} from "@workspace/shared/workout";
import { isGameFreeForUser } from "./catalogueService";

export type Tier = "free" | "premium";

export type DomainCounts = Partial<Record<Domain, number>>;

export type PlannedGame = {
  gameId: string;
  slug: string;
  domain: string;
  title: string;
  averageDurationSec: number;
  supportsRelaxed: boolean;
};

export type SelectWorkoutInput = {
  userId: string;
  focusDomain: Domain;
  tier: Tier;
  domainCountsLast7Days: DomainCounts;
  availableGames: ReadonlyArray<Game>;
  today: Date;
};

/**
 * Pure function that selects 3-5 games for the user's daily workout.
 *
 * Rules:
 *   - Cover the focus domain at least once (if a game exists for it).
 *   - Balance the OTHER 5 domains over a 7-day rolling window: domains
 *     played LESS recently are prioritised.
 *   - Free-tier users only get games where `isFreeTier === true` OR the
 *     weekly free-tier rotation marks the game free this week.
 *   - Prefer to stay under the ≤12-minute target, but always honour the
 *     3-game minimum even if it slightly overshoots.
 *
 * Deterministic for the same inputs (no internal randomness) so it is
 * straightforward to unit-test.
 */
export function selectWorkoutGames(input: SelectWorkoutInput): Game[] {
  const { userId, focusDomain, tier, domainCountsLast7Days, availableGames, today } =
    input;

  // 1. Filter to games the user can access this week.
  const accessible = availableGames.filter((game) => {
    if (tier === "premium") return true;
    return isGameFreeForUser(userId, game, today);
  });

  // 2. Bucket by domain, picking ONE representative per domain (stable: by slug).
  const byDomain = new Map<string, Game>();
  const sortedAccessible = [...accessible].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );
  for (const g of sortedAccessible) {
    if (!byDomain.has(g.domain)) byDomain.set(g.domain, g);
  }

  // 3. Always start with the focus domain if a game exists for it.
  const selected: Game[] = [];
  const focusGame = byDomain.get(focusDomain);
  if (focusGame) selected.push(focusGame);

  // 4. Fill remaining slots from least-recently-played domains.
  const otherDomains: Domain[] = DOMAINS.filter((d) => d !== focusDomain);
  const ordered = otherDomains
    .filter((d) => byDomain.has(d))
    .sort((a, b) => {
      const ca = domainCountsLast7Days[a] ?? 0;
      const cb = domainCountsLast7Days[b] ?? 0;
      if (ca !== cb) return ca - cb; // fewer plays first
      return a.localeCompare(b); // tie-break alphabetically for determinism
    });

  let totalDuration = selected.reduce(
    (sum, g) => sum + g.averageDurationSec,
    0,
  );

  for (const domain of ordered) {
    if (selected.length >= WORKOUT_MAX_GAMES) break;
    const game = byDomain.get(domain)!;
    const wouldExceed =
      totalDuration + game.averageDurationSec > WORKOUT_TARGET_DURATION_SEC;
    if (wouldExceed && selected.length >= WORKOUT_MIN_GAMES) continue;
    selected.push(game);
    totalDuration += game.averageDurationSec;
  }

  // Floor guarantee: if the per-domain cap left us below MIN, top up with any
  // remaining accessible games (allowing additional same-domain fallbacks).
  if (selected.length < WORKOUT_MIN_GAMES) {
    const selectedIds = new Set(selected.map((g) => g.id));
    for (const game of sortedAccessible) {
      if (selected.length >= WORKOUT_MIN_GAMES) break;
      if (selectedIds.has(game.id)) continue;
      selected.push(game);
      selectedIds.add(game.id);
    }
  }

  return selected;
}

/** Convert internal `Game` rows to the trimmed shape we persist + return. */
export function toPlannedGame(game: Game): PlannedGame {
  return {
    gameId: game.id,
    slug: game.slug,
    domain: game.domain,
    title: game.title,
    averageDurationSec: game.averageDurationSec,
    supportsRelaxed: game.supportsRelaxed,
  };
}
