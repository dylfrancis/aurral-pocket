import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { logout } from "@/lib/api/auth";
import { AppStorage, SecureStorage } from "@/lib/storage";

export function useLogout() {
  const {
    clearAuth,
    setRememberCredentials,
    setUseBiometrics,
    requestOidcLogout,
  } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Read the logout URL before `onSettled` clears it. Ending the provider
      // session is `OidcLogoutWebView` work; left open, it would sign the user
      // straight back in.
      const oidcLogoutUrl = await AppStorage.getOidcLogoutUrl();
      logout().catch(() => {});
      if (oidcLogoutUrl) requestOidcLogout(oidcLogoutUrl);
    },
    onSettled: async () => {
      await setRememberCredentials(false);
      await setUseBiometrics(false);
      await SecureStorage.deleteCredentials();
      await clearAuth();
      queryClient.clear();
    },
  });
}
