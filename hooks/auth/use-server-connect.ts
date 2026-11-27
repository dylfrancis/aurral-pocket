import { useMutation } from "@tanstack/react-query";
import { setBaseUrl, setCustomHeaders } from "@/lib/api/client";
import {
  checkServerLive,
  getServerHealth,
  SUPPORTED_API_VERSION,
} from "@/lib/api/health";
import { startGateway, stopGateway, waitForTailnet } from "@/lib/tailscale";
import type { TailscaleSettings } from "@/lib/types/tailscale";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

type ServerConnection = {
  url: string;
  /** Applied before the health check, which a proxy refuses without them. */
  headers: Record<string, string>;
  /** Reach the server through the app's own Tailscale node. */
  tailscale?: { authKey?: string; controlURL?: string } | null;
  /** Aborts joining the tailnet, as when the sheet closes. */
  signal?: AbortSignal;
};

/**
 * Checks a server pocket can use. Saving it is the caller's, with setServer:
 * that leaves the Get Started page, which has to close its sheet first.
 */
export function useServerConnect() {
  return useMutation({
    mutationFn: async ({
      url,
      headers,
      tailscale,
      signal,
    }: ServerConnection) => {
      const normalized = normalizeUrl(url);
      setCustomHeaders(headers);
      let settings: TailscaleSettings | null = null;
      if (tailscale) {
        settings = tailscale.controlURL
          ? { controlURL: tailscale.controlURL }
          : {};
        setBaseUrl(await startGateway(normalized, settings, tailscale.authKey));
        await waitForTailnet({ signal, usingAuthKey: !!tailscale.authKey });
      } else {
        // A gateway left by an earlier try mustn't fail this connect.
        await stopGateway().catch(() => {});
        setBaseUrl(normalized);
      }
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
      return { url: normalized, health, headers, tailscale: settings };
    },
    onError: () => {
      setBaseUrl("");
      setCustomHeaders({});
      // The node keeps its keys, so trying again needs no new sign-in.
      void stopGateway().catch(() => {});
    },
  });
}
