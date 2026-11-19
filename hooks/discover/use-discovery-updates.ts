import { useQueryClient } from "@tanstack/react-query";
import { useLiveChannel } from "@/hooks/live/use-live-channel";
import { discoverKeys } from "@/lib/query-keys";

/** Refreshes recommendations and Made for You once Aurral rebuilds them. */
export function useDiscoveryUpdates() {
  const queryClient = useQueryClient();
  useLiveChannel("discovery", ["discovery_update"], (message) => {
    if (message.phase !== "completed") return;
    void queryClient.invalidateQueries({ queryKey: discoverKeys.discovery() });
    void queryClient.invalidateQueries({ queryKey: discoverKeys.madeForYou() });
  });
}
