import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

/**
 * Domain order matches @workspace/shared/achievements.DOMAINS — kept as a
 * local string-literal type so this module stays free of node_modules
 * coupling at runtime (the shared package is TS-only and tree-shakes
 * fine, but keeping the wire types here makes the API contract explicit
 * at the screen boundary).
 */
export type ProgressDomain =
  | "vocabulary"
  | "writing"
  | "reading"
  | "speaking"
  | "math"
  | "memory";

export const PROGRESS_DOMAINS: ProgressDomain[] = [
  "vocabulary",
  "writing",
  "reading",
  "speaking",
  "math",
  "memory",
];

export type DailyCompletion = { date: string; count: number };

export type UnlockedAchievement = {
  id: string;
  title: string;
  description: string;
};

export type ProgressSummary = {
  streak: {
    current: number;
    longest: number;
    freezesAvailable: number;
    lastActiveDate: string | null;
  };
  proficiency: Record<ProgressDomain, number>;
  bands: Record<ProgressDomain, string>;
  totals: { workoutsCompleted: number; gamesCompleted: number };
  dailyCompletions: DailyCompletion[];
  achievements: UnlockedAchievement[];
};

export const progressSummaryKeys = {
  all: ["progress", "summary"] as const,
};

export function useProgressSummary(enabled: boolean) {
  return useQuery({
    queryKey: progressSummaryKeys.all,
    queryFn: () => api.get<ProgressSummary>("/api/progress/summary"),
    enabled,
    staleTime: 30_000,
  });
}
