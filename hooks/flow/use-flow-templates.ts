import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { getFlowTemplates } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";

/**
 * The tab stays mounted, so without the stale refetch on focus Listening
 * History would stay unavailable after the user starts listening. Callers must
 * gate on `accessFlow`.
 */
export function useFlowTemplates() {
  const queryClient = useQueryClient();
  useRefreshOnFocus(
    useCallback(() => {
      void queryClient.refetchQueries({
        queryKey: flowKeys.templates(),
        stale: true,
      });
    }, [queryClient]),
  );
  return useQuery({
    queryKey: flowKeys.templates(),
    queryFn: getFlowTemplates,
  });
}
