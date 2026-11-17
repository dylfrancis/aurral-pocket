import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import * as Burnt from "burnt";
import { cancelQueuedDownloads } from "@/lib/api/activity";
import { updateWorkerSettings } from "@/lib/api/flow";
import { activityKeys, flowKeys, libraryKeys } from "@/lib/query-keys";
import type { ActivityPage } from "@/lib/types/activity";

function invalidateDownloads(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: activityKeys.feedAll() });
  void queryClient.invalidateQueries({
    queryKey: activityKeys.downloadStatusesAll(),
  });
  void queryClient.invalidateQueries({ queryKey: flowKeys.jobsAll() });
  void queryClient.invalidateQueries({ queryKey: flowKeys.status() });
  void queryClient.invalidateQueries({
    queryKey: libraryKeys.downloadStatusesAll(),
  });
}

export function useCancelQueuedDownloads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cause: string | null) => cancelQueuedDownloads(cause),
    onError: () => {
      Burnt.toast({ title: "Couldn't cancel the downloads", preset: "error" });
    },
    onSettled: () => invalidateDownloads(queryClient),
  });
}

function setCachedPaused(queryClient: QueryClient, paused: boolean) {
  queryClient.setQueriesData<InfiniteData<ActivityPage>>(
    { queryKey: activityKeys.pagesAll() },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({ ...page, paused })),
      },
  );
}

/**
 * Pauses or resumes Aurral's download queue, for admins. The banner follows
 * at once; a failure puts it back.
 */
export function usePauseQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paused: boolean) => updateWorkerSettings({ paused }),
    onMutate: async (paused) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.pagesAll() });
      setCachedPaused(queryClient, paused);
    },
    onError: (_error, paused) => {
      setCachedPaused(queryClient, !paused);
      Burnt.toast({
        title: paused
          ? "Couldn't pause the queue"
          : "Couldn't resume the queue",
        preset: "error",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.feedAll() });
      void queryClient.invalidateQueries({
        queryKey: flowKeys.workerSettings(),
      });
    },
  });
}
