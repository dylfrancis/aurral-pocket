import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { fillQueueCovers } from "@/hooks/player/queue-covers";
import { startQueueSync } from "@/lib/player/queue-sync";

/**
 * Keeps the signed-in account's play queue in step with Aurral's copy. Mount it
 * after the saved queue's restore starts, so a queue from another device waits
 * for it rather than taking its place.
 */
export function useQueueSync() {
  const userId = useAuth().user?.id;
  const queryClient = useQueryClient();

  useEffect(
    () =>
      userId === undefined
        ? undefined
        : startQueueSync({
            // Playlist tracks come with no cover, as they do on the web.
            onTakenOver: (items) => void fillQueueCovers(queryClient, items),
          }),
    [userId, queryClient],
  );
}
