import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type DeletionStatus = {
  scheduledAt: string | null;
  purgeAt: string | null;
};

export type ScheduleDeletionResponse = {
  scheduledAt: string;
  purgeAt: string;
  reverseWindowDays: number;
};

export const ACCOUNT_QK = {
  deletionStatus: ["account", "deletion-status"] as const,
};

export function useDeletionStatus() {
  return useQuery({
    queryKey: ACCOUNT_QK.deletionStatus,
    queryFn: () => api.get<DeletionStatus>("/api/auth/deletion-status"),
  });
}

export function useScheduleDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ScheduleDeletionResponse>("/api/auth/delete-me", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNT_QK.deletionStatus });
    },
  });
}

export function useUndoDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ restored: boolean }>("/api/auth/undo-delete", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNT_QK.deletionStatus });
    },
  });
}
