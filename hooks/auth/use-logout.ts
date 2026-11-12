import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { logout } from "@/lib/api/auth";
import { AppStorage, SecureStorage } from "@/lib/storage";

/**
 * Ends the session on the server, and with it any SSO provider session, which
 * left open would sign the user straight back in. The caller clears what pocket
 * keeps.
 */
export async function endServerSession(
  requestOidcLogout: (logoutUrl: string) => void,
) {
  // Read before the caller's cleanup deletes it. Ending the provider session
  // is `OidcLogoutWebView` work.
  const oidcLogoutUrl = await AppStorage.getOidcLogoutUrl();
  logout().catch(() => {});
  if (oidcLogoutUrl) requestOidcLogout(oidcLogoutUrl);
}

export function useLogout() {
  const {
    clearAuth,
    setRememberCredentials,
    setUseBiometrics,
    requestOidcLogout,
  } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => endServerSession(requestOidcLogout),
    onSettled: async () => {
      await setRememberCredentials(false);
      await setUseBiometrics(false);
      await SecureStorage.deleteCredentials();
      await clearAuth();
      queryClient.clear();
    },
  });
}
