import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { logout } from '@/lib/api/auth';

export function useLogout() {
  const { clearAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logout().catch(() => {});
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}
