import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getServerHealth } from "@/lib/api/health";
import { authKeys } from "@/lib/query-keys";

/**
 * Bootstrap tells only a signed-in caller whether Lidarr is connected, and
 * the login screen has already cached the signed-out answer, so this reads
 * bootstrap under its own key.
 */
export function useLidarrConfigured() {
  const { serverUrl, token } = useAuth();
  const { data } = useQuery({
    queryKey: authKeys.signedInHealth(serverUrl ?? ""),
    queryFn: getServerHealth,
    enabled: !!serverUrl && !!token,
    staleTime: 60_000,
  });
  return data?.lidarrConfigured === true;
}
