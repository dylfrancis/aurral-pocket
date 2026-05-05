import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getWorkerSettings, updateWorkerSettings } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";
import type { WorkerSettings } from "@/lib/types/flow";

export function useWorkerSettings() {
  const { serverUrl, token } = useAuth();

  return useQuery({
    queryKey: flowKeys.workerSettings(),
    queryFn: getWorkerSettings,
    enabled: !!serverUrl && !!token,
    staleTime: 60 * 1000,
  });
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
