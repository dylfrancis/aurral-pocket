import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveBlockedJob, denyBlockedJob } from "@/lib/api/flow";
import { activityKeys, flowKeys } from "@/lib/query-keys";
import type { ActivityItem } from "@/lib/types/activity";

/**
 * Drops the decided job from the cached feed straight away — the row is
 * disappearing from Review either way, so waiting on a refetch just leaves a
 * dead row under the user's finger.
 */
function useJobDecision(mutationFn: (jobId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (jobId: string) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.list() });
      const prev = queryClient.getQueryData<ActivityItem[]>(
        activityKeys.list(),
      );
      queryClient.setQueryData<ActivityItem[]>(activityKeys.list(), (old) =>
        old
          ? old.filter((item) => item.type === "album" || item.jobId !== jobId)
          : old,
      );
      return { prev };
    },
    onError: (_error, _jobId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(activityKeys.list(), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.list() });
      // Approving imports the track into its playlist, so flow status is stale.
      queryClient.invalidateQueries({ queryKey: flowKeys.status() });
    },
  });
}

export function useApproveBlockedJob() {
  return useJobDecision(approveBlockedJob);
}

export function useDenyBlockedJob() {
  return useJobDecision(denyBlockedJob);
}
