import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getServerHealth } from "@/lib/api/health";
import { authKeys } from "@/lib/query-keys";

/**
 * Health for the configured server. Safe before sign-in: an unauthenticated
 * caller still gets the bootstrap fields, including whether OIDC is configured.
 */
export function useServerHealth() {
  const { serverUrl } = useAuth();

  return useQuery({
    queryKey: authKeys.health(serverUrl ?? ""),
    queryFn: getServerHealth,
    enabled: !!serverUrl,
    staleTime: 60_000,
  });
}
