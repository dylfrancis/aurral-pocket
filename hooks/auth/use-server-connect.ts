import { useMutation } from "@tanstack/react-query";
import { setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import {
  checkServerLive,
  getServerHealth,
  SUPPORTED_API_VERSION,
} from "@/lib/api/health";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

type ServerConnection = {
  url: string;
  /** Applied before the health check, which a proxy refuses without them. */
  headers: Record<string, string>;
};

/**
 * Checks a server pocket can use. Saving it is the caller's, with setServer:
 * that leaves the Get Started page, which has to close its sheet first.
 */
export function useServerConnect() {
  return useMutation({
    mutationFn: async ({ url, headers }: ServerConnection) => {
      const normalized = normalizeUrl(url);
      setBaseUrl(normalized);
      setCustomHeaders(headers);
      await checkServerLive();
      const health = await getServerHealth();
      // Any other contract version renames or drops fields pocket reads, so
      // refuse the server instead of misreading its responses.
      if (health.api && health.api.version > SUPPORTED_API_VERSION) {
        throw new Error(
          "This server is newer than Aurral Pocket supports. Update the app and try again.",
        );
      }
      if (health.api && health.api.version < SUPPORTED_API_VERSION) {
        throw new Error(
          "This server runs an older Aurral than Aurral Pocket supports. Update Aurral and try again.",
        );
      }
      return { url: normalized, health, headers };
    },
    onError: () => {
      setBaseUrl("");
      setCustomHeaders({});
    },
  });
}
