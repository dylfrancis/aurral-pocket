import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { getWorkerSettings, updateWorkerSettings } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type { WorkerSettings } from "@/lib/types/flow";

export function workerSettingsQueryOptions() {
  return queryOptions({
    queryKey: flowKeys.workerSettings(),
    queryFn: getWorkerSettings,
    staleTime: 60 * 1000,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}

/**
 * Suspense variant. Caller must be inside a Suspense + ErrorBoundary (Expo
 * Router wraps every route automatically), and inside the `(app)` route group
 * (auth is guaranteed there).
 */
export function useWorkerSettings() {
  return useSuspenseQuery(workerSettingsQueryOptions());
}

export function useUpdateWorkerSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<WorkerSettings>) =>
      updateWorkerSettings(settings),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: flowKeys.workerSettings() });
      const prev = queryClient.getQueryData<WorkerSettings>(
        flowKeys.workerSettings(),
      );
      if (prev) {
        queryClient.setQueryData<WorkerSettings>(flowKeys.workerSettings(), {
          ...prev,
          ...settings,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(flowKeys.workerSettings(), context.prev);
      }
    },
    onSuccess: (next) => {
      queryClient.setQueryData(flowKeys.workerSettings(), next);
    },
  });
}
