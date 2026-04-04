import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { login } from '@/lib/api/auth';
import { authKeys } from '@/lib/query-keys';
import type { LoginRequest } from '@/lib/types/auth';

export function useLogin() {
  const { serverUrl, setAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (creds: LoginRequest) => login(creds),
    onSuccess: async (data) => {
      await setAuth(data.token, data.user, data.expiresAt);
      queryClient.setQueryData(authKeys.me(serverUrl!), {
        user: data.user,
        expiresAt: data.expiresAt,
      });
    },
  });
}
