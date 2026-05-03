import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Per-workout local progress, used to RESUME a workout after a force-quit.
 *
 * Stored under `nf_workout:<id>` with shape:
 *   {
 *     completedGameIds: string[],   // in completion order
 *     scores: { [gameId]: number },
 *   }
 *
 * Scope: this is a UI helper to remember "where was I" — the server's
 * /workout/:id/complete remains the source of truth for whether a workout
 * is finished (via session.completedAt).
 */

const PREFIX = "nf_workout:";

export type WorkoutProgress = {
  completedGameIds: string[];
  scores: Record<string, number>;
};

const empty = (): WorkoutProgress => ({ completedGameIds: [], scores: {} });

function key(workoutId: string): string {
  return `${PREFIX}${workoutId}`;
}

export async function getWorkoutProgress(
  workoutId: string,
): Promise<WorkoutProgress> {
  const raw = await AsyncStorage.getItem(key(workoutId));
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as WorkoutProgress;
    return {
      completedGameIds: Array.isArray(parsed.completedGameIds)
        ? parsed.completedGameIds
        : [],
      scores:
        parsed.scores && typeof parsed.scores === "object"
          ? parsed.scores
          : {},
    };
  } catch {
    return empty();
  }
}

export async function recordGameCompleted(
  workoutId: string,
  gameId: string,
  score: number,
): Promise<WorkoutProgress> {
  const current = await getWorkoutProgress(workoutId);
  if (!current.completedGameIds.includes(gameId)) {
    current.completedGameIds.push(gameId);
  }
  current.scores[gameId] = score;
  await AsyncStorage.setItem(key(workoutId), JSON.stringify(current));
  return current;
}

export async function clearWorkoutProgress(workoutId: string): Promise<void> {
  await AsyncStorage.removeItem(key(workoutId));
}

/**
 * Compute the index in `gameIds` of the first game that has NOT been
 * completed yet. Returns `gameIds.length` if all are done — caller can
 * treat that as "ready to submit".
 */
export function firstPendingIndex(
  gameIds: ReadonlyArray<string>,
  completedGameIds: ReadonlyArray<string>,
): number {
  const done = new Set(completedGameIds);
  for (let i = 0; i < gameIds.length; i++) {
    if (!done.has(gameIds[i]!)) return i;
  }
  return gameIds.length;
}
