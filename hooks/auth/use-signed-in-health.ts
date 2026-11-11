import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getServerHealth } from "@/lib/api/health";
import { authKeys } from "@/lib/query-keys";

/**
 * Bootstrap sends some fields only to a signed-in caller, and the login screen
 * has already cached the signed-out answer, so this reads bootstrap under its
 * own key.
 */
export function useSignedInHealth() {
  const { serverUrl, token } = useAuth();
  return useQuery({
    queryKey: authKeys.signedInHealth(serverUrl ?? ""),
    queryFn: getServerHealth,
    enabled: !!serverUrl && !!token,
    staleTime: 60_000,
  });
}
