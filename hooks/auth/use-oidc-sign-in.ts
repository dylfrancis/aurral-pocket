import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getServerHealth } from "@/lib/api/health";
import { authKeys } from "@/lib/query-keys";
import type { HealthResponse, OidcSession } from "@/lib/types/auth";

/**
 * Stores a session that came from OIDC, the way `useLogin` stores a password
 * one. The exchange itself happened inside the WebView (see `lib/oidc.ts`), so
 * only the result lands here.
 */
export function useOidcSignIn() {
  const { serverUrl, setAuth, markOidcSession } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    async (session: OidcSession) => {
      await setAuth(session.token, session.user, session.expiresAt);

      // Read the logout URL here rather than subscribe to health for the whole
      // session: only an OIDC sign-in needs it, and the login screen has
      // already cached a fresh health response.
      let logoutUrl: string | null = null;
      try {
        const health = await queryClient.fetchQuery<HealthResponse>({
          queryKey: authKeys.health(serverUrl ?? ""),
          queryFn: getServerHealth,
          staleTime: 60_000,
        });
        logoutUrl = health.oidcLogoutUrl ?? null;
      } catch {
        // An unreachable server costs the logout URL, not the sign-in.
      }
      await markOidcSession(logoutUrl);

      queryClient.setQueryData(authKeys.me(serverUrl ?? ""), {
        user: session.user,
        expiresAt: session.expiresAt,
      });
    },
    [serverUrl, setAuth, markOidcSession, queryClient],
  );
}
