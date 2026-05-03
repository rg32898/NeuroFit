import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Typed wrappers + React Query hooks for the workout + progress endpoints.
 *
 * Note: this codebase has not (yet) wired the workout endpoints into the
 * OpenAPI spec, so we're calling them through `api.*` directly with
 * narrow inline types. When the spec is filled in (Prompt 14+), swap
 * these for the generated `useWorkoutToday` etc. — the React Query keys
 * here mirror what Orval will produce so the swap is one-line.
 */

// ── Types (mirror the server response shapes) ───────────────────────────────

export type PlannedGame = {
  gameId: string;
  slug: string;
  domain: string;
  title: string;
  averageDurationSec: number;
  supportsRelaxed: boolean;
};

export type WorkoutSession = {
  id: string;
  date: string;
  completedAt: string | null;
  gamesPlanned: PlannedGame[];
  estimatedDurationSec: number;
};

export type WorkoutTodayResponse = {
  session: WorkoutSession;
  created: boolean;
};

export type WorkoutCompleteRequest = {
  results: Array<{ gameId: string; score: number }>;
};

export type ProficiencyDelta = {
  domain: string;
  decision: string;
  delta: number;
  score: number;
};

export type StreakSummary = {
  current: number;
  longest: number;
  lastActiveDate: string | null;
};

export type WorkoutCompleteResponse = {
  sessionId: string;
  completed: true;
  streak: StreakSummary;
  proficiencyDeltas: ProficiencyDelta[];
};

export type StreakResponse = {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  freezesAvailable: number;
};

// ── Query keys ─────────────────────────────────────────────────────────────

export const workoutKeys = {
  all: ["workout"] as const,
  today: () => [...workoutKeys.all, "today"] as const,
  byId: (id: string) => [...workoutKeys.all, id] as const,
};

export const progressKeys = {
  all: ["progress"] as const,
  streak: () => [...progressKeys.all, "streak"] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useWorkoutToday(enabled = true) {
  return useQuery({
    queryKey: workoutKeys.today(),
    queryFn: () => api.get<WorkoutTodayResponse>("/api/workout/today"),
    enabled,
    // The workout-of-the-day is generated server-side and cached for the
    // calendar day — no need to refetch on focus / mount within the day.
    staleTime: 5 * 60 * 1000,
  });
}

export function useStreakQuery(enabled = true) {
  return useQuery({
    queryKey: progressKeys.streak(),
    queryFn: () => api.get<StreakResponse>("/api/progress/streak"),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useCompleteWorkoutMutation() {
  return useMutation({
    mutationFn: async (input: { workoutId: string; results: WorkoutCompleteRequest["results"] }) => {
      return api.post<WorkoutCompleteResponse>(
        `/api/workout/${input.workoutId}/complete`,
        { results: input.results },
      );
    },
  });
}
