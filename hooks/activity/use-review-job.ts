import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { approveBlockedJob, denyBlockedJob } from "@/lib/api/flow";
import { activityKeys, flowKeys } from "@/lib/query-keys";
import type { ActivityPage } from "@/lib/types/activity";

/**
 * Drops the decided job from the cached pages straight away — the row is
 * leaving Review and the Queue either way, so waiting on a refetch just
 * leaves a dead row under the user's finger.
 */
function useJobDecision(mutationFn: (jobId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (jobId: string) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.pagesAll() });
      const prev = queryClient.getQueriesData<InfiniteData<ActivityPage>>({
        queryKey: activityKeys.pagesAll(),
      });
      queryClient.setQueriesData<InfiniteData<ActivityPage>>(
        { queryKey: activityKeys.pagesAll() },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.jobId !== jobId),
            })),
          },
      );
      return { prev };
    },
    onError: (_error, _jobId, context) => {
      for (const [key, data] of context?.prev ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.feedAll() });
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
