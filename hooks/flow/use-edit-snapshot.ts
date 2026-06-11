import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flowStatusQueryOptions } from "./use-flow-status";
import type { FlowStatusSnapshot } from "@/lib/types/flow";

type Result<T> = {
  snapshot: T | undefined;
  isLoading: boolean;
};

/**
 * Resolves the entity being edited from the flow status cache exactly once,
 * with a one-shot fetch fallback for cold starts (deep links).
 *
 * Edit screens must not subscribe to the polling status query: a poll-tick
 * re-render mid-gesture snaps the iOS hour wheel back to the stale value
 * (#138), and a background refetch must never reset an in-progress draft.
 */
export function useEditSnapshot<T>(
  enabled: boolean,
  select: (status: FlowStatusSnapshot) => T | undefined,
): Result<T> {
  const queryClient = useQueryClient();
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });

  const [state, setState] = useState<Result<T>>(() => {
    if (!enabled) return { snapshot: undefined, isLoading: false };
    const cached = queryClient.getQueryData<FlowStatusSnapshot>(
      flowStatusQueryOptions().queryKey,
    );
    if (cached) return { snapshot: select(cached), isLoading: false };
    return { snapshot: undefined, isLoading: true };
  });

  useEffect(() => {
    if (!state.isLoading) return;
    let cancelled = false;
    queryClient
      .ensureQueryData(flowStatusQueryOptions())
      .then((status) => {
        if (cancelled) return;
        setState({ snapshot: selectRef.current(status), isLoading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ snapshot: undefined, isLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient, state.isLoading]);

  return state;
}
