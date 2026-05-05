import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { getFlowStatus } from "@/lib/api/flow";
import { flowKeys } from "@/lib/query-keys";

const POLL_INTERVAL_MS = 3000;

export function useFlowStatus() {
  const { serverUrl, token } = useAuth();
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return useQuery({
    queryKey: flowKeys.status(),
    queryFn: getFlowStatus,
    enabled: !!serverUrl && !!token,
    staleTime: 1000,
    refetchInterval: focused ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}
