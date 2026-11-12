import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { endServerSession } from "@/hooks/auth/use-logout";

/**
 * Signs out of this server, then forgets it: its URL, saved sign-in, custom
 * headers, queue and unsent plays. The login screen's Change Server only
 * forgets, since nobody is signed in there.
 */
export function useChangeServer() {
  const { clearAll, requestOidcLogout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => endServerSession(requestOidcLogout),
    onSettled: async () => {
      await clearAll();
      queryClient.clear();
    },
  });
}
