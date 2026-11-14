import { useCallback, useState } from "react";
import * as Burnt from "burnt";

/** A refresh fails when it resolves to false or to a query result in error. */
function refreshFailed(outcome: unknown): boolean {
  if (outcome === false) return true;
  return (
    typeof outcome === "object" &&
    outcome !== null &&
    "isError" in outcome &&
    outcome.isError === true
  );
}

/**
 * RefreshControl state with its own flag, not isRefetching, so a refetch nobody
 * pulled shows no spinner. A refresh that fails or throws toasts `errorTitle`.
 */
export function usePullToRefresh(
  refresh: () => Promise<unknown>,
  errorTitle?: string,
) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const failed = await refresh().then(refreshFailed, () => true);
    setRefreshing(false);
    if (errorTitle && failed) {
      Burnt.toast({ title: errorTitle, preset: "error" });
    }
  }, [refresh, errorTitle]);

  return { refreshing, onRefresh };
}
