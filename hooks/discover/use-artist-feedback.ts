import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import {
  addDiscoveryFeedback,
  deleteDiscoveryFeedback,
  getDiscoveryFeedback,
} from "@/lib/api/discovery-feedback";
import { findArtistFeedback } from "@/lib/blocklist";
import { discoverKeys } from "@/lib/query-keys";
import type { DiscoveryFeedbackAction } from "@/lib/types/discovery-feedback";

/** Setting one rating takes the other away, as on the web. */
const OPPOSITE: Partial<
  Record<DiscoveryFeedbackAction, DiscoveryFeedbackAction>
> = {
  more_like_this: "less_like_this",
  less_like_this: "more_like_this",
};

/**
 * One artist's discovery feedback: More Like This, Less Like This and the
 * block. Each toggles: set, a tap takes it back. The blocklist names artists
 * by MBID, so callers offer these only for an artist that has one.
 */
export function useArtistFeedback(
  artist: { mbid: string | null | undefined; name: string },
  /** Where the feedback came from, recorded on its row. */
  sourceContext: string,
) {
  const queryClient = useQueryClient();
  const { mbid, name } = artist;
  // The blocklist reads the same rows. A failed read only hides the marks.
  const { data: entries } = useQuery({
    queryKey: discoverKeys.feedback(),
    queryFn: getDiscoveryFeedback,
    throwOnError: false,
  });
  const find = useCallback(
    (action: DiscoveryFeedbackAction) =>
      findArtistFeedback(entries, { id: mbid, name }, action),
    [entries, mbid, name],
  );

  const mutation = useMutation({
    mutationFn: async (action: DiscoveryFeedbackAction) => {
      const current = find(action);
      if (current) {
        await deleteDiscoveryFeedback(current.id);
        return false;
      }
      const opposite = OPPOSITE[action];
      const other = opposite ? find(opposite) : undefined;
      if (other) await deleteDiscoveryFeedback(other.id);
      await addDiscoveryFeedback({
        action,
        artistId: mbid ?? null,
        artistName: name,
        sourceContext,
      });
      return true;
    },
    onSuccess: (set, action) =>
      Burnt.toast({ title: doneTitle(action, set, name), preset: "done" }),
    onError: (_error, action) =>
      Burnt.toast({
        title:
          action === "block_artist"
            ? find(action)
              ? "Couldn't unblock artist"
              : "Couldn't block artist"
            : "Couldn't save your feedback",
        preset: "error",
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: discoverKeys.feedback() });
      // Recommendations are filtered by feedback server-side, so they are
      // stale the moment it changes.
      void queryClient.invalidateQueries({
        queryKey: discoverKeys.discovery(),
      });
    },
  });
  const { mutate } = mutation;

  const toggle = useCallback(
    (action: DiscoveryFeedbackAction) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      mutate(action);
    },
    [mutate],
  );

  return {
    isSet: (action: DiscoveryFeedbackAction) => !!find(action),
    toggle,
    isPending: mutation.isPending,
  };
}

// Android shows only a toast's title, so the title says it all.
function doneTitle(
  action: DiscoveryFeedbackAction,
  set: boolean,
  name: string,
): string {
  switch (action) {
    case "block_artist":
      return set ? `Blocked ${name}` : `Unblocked ${name}`;
    case "more_like_this":
      return set ? `More like ${name} from now on` : "Feedback removed";
    case "less_like_this":
      return set ? `Less like ${name} from now on` : "Feedback removed";
  }
}
