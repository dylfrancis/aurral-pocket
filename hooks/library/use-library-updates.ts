import { useQueryClient } from "@tanstack/react-query";
import { useLiveChannel } from "@/hooks/live/use-live-channel";
import { discoverKeys, isLibraryIndexKey } from "@/lib/query-keys";

/**
 * Refreshes the Library after any scan and the release rails after a metadata
 * refresh. A scan follows every download, so only Library index reads refetch.
 */
export function useLibraryUpdates() {
  const queryClient = useQueryClient();
  useLiveChannel(
    "library",
    ["library_scan_completed", "release_metadata_refreshed"],
    (message) => {
      if (message.type === "library_scan_completed") {
        void queryClient.invalidateQueries({
          predicate: (query) => isLibraryIndexKey(query.queryKey),
        });
        void queryClient.invalidateQueries({
          queryKey: discoverKeys.recentlyAdded(),
        });
      } else {
        void queryClient.invalidateQueries({
          queryKey: discoverKeys.recentReleases(),
        });
      }
    },
  );
}
