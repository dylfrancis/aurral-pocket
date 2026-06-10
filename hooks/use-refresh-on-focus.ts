import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Calls `refetch` whenever the screen regains focus. Native tabs keep screens
 * mounted, so React Query never sees a remount when the user returns to a
 * tab — without this, a focus-gated `refetchInterval` waits a full interval
 * before the first refetch. Skips the initial focus; the query handles its
 * own first fetch.
 */
export function useRefreshOnFocus(refetch: () => void) {
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}
