import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { logout } from '@/lib/api/auth';
import { SecureStorage } from '@/lib/storage';

export function useLogout() {
  const { clearAuth, setRememberCredentials, setUseBiometrics } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logout().catch(() => {});
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
