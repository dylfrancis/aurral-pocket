import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { setBaseUrl } from "@/lib/api/client";
import { checkServerLive, getServerHealth } from "@/lib/api/health";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function useServerConnect() {
  const { setServer } = useAuth();

  return useMutation({
    mutationFn: async (url: string) => {
      const normalized = normalizeUrl(url);
      setBaseUrl(normalized);
      await checkServerLive();
      const health = await getServerHealth();
      return { url: normalized, health };
    },
    onSuccess: ({ url, health }) => {
      setServer(url, health);
    },
    onError: () => {
      setBaseUrl("");
    },
  });
}
