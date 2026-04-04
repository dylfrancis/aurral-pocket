import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/client';
import { getMe } from '@/lib/api/auth';
import { authKeys } from '@/lib/query-keys';

export function useSession() {
  const { serverUrl, token, updateExpiresAt } = useAuth();

  return useQuery({
    queryKey: authKeys.me(serverUrl ?? ''),
    queryFn: async () => {
      const data = await getMe();
      if (data.expiresAt) {
        await updateExpiresAt(data.expiresAt);
      }
      return data;
    },
    enabled: !!serverUrl && !!token,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });
}
