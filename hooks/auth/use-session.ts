import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/client';
import { getMe } from '@/lib/api/auth';
import { authKeys } from '@/lib/query-keys';

export function useSession() {
  const { serverUrl, token, clearAuth } = useAuth();

  const query = useQuery({
    queryKey: authKeys.me(serverUrl ?? ''),
    queryFn: () => getMe(),
    enabled: !!serverUrl && !!token,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Clear auth on 401 so the routing gate redirects to login
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      clearAuth();
    }
  }, [query.error, clearAuth]);

  return query;
}
