import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { setBaseUrl } from "@/lib/api/client";
import {
  checkServerLive,
  getServerHealth,
  SUPPORTED_API_VERSION,
} from "@/lib/api/health";

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
      // A new contract version means a breaking change pocket has not
      // adopted, so refuse the server instead of misreading its responses.
      if (health.api && health.api.version !== SUPPORTED_API_VERSION) {
        throw new Error(
          "This server is newer than Aurral Pocket supports. Update the app and try again.",
        );
      }
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
