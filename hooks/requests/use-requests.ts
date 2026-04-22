import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "@/contexts/auth-context";
import { getRequests } from "@/lib/api/requests";
import { requestsKeys } from "@/lib/query-keys";

const ACTIVE_POLL_MS = 15_000;

export function useRequests() {
  const { serverUrl, token } = useAuth();
  const isFocused = useIsFocused();

  return useQuery({
    queryKey: requestsKeys.list(),
    queryFn: getRequests,
    enabled: !!serverUrl && !!token,
    refetchInterval: isFocused ? ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}
