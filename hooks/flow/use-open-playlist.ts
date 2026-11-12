import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { useNavigateToTab } from "@/hooks/use-navigate-to-tab";
import { flowKeys } from "@/lib/query-keys";
import type { FlowStatusSnapshot } from "@/lib/types/flow";
import { flowStatusQueryOptions } from "./use-flow-status";

const isFlow = (status: FlowStatusSnapshot | undefined, id: string) =>
  !!status?.flows.some((flow) => flow.id === id);

const isStaticPlaylist = (status: FlowStatusSnapshot | undefined, id: string) =>
  !!status?.sharedPlaylists.some((playlist) => playlist.id === id);

/**
 * An id never changes kind, so a cached snapshot that knows it answers without
 * a request, and the tap responds at once. An id nobody knows, or a failed
 * lookup, lands on Library > Playlists, as the web's redirect does.
 *
 * Callers must gate on `accessFlow`: the lookup answers 403 without it.
 */
export function useOpenPlaylist() {
  const navigateToTab = useNavigateToTab();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  return useCallback(
    async (id: string) => {
      const cached = queryClient.getQueryData<FlowStatusSnapshot>(
        flowKeys.status(),
      );
      const status =
        isFlow(cached, id) || isStaticPlaylist(cached, id)
          ? cached
          : await queryClient
              .fetchQuery({
                ...flowStatusQueryOptions(),
                staleTime: 0,
                retry: false,
              })
              .catch(() => undefined);

      // A slow lookup must not pull back someone who has already moved on.
      if (!navigation.isFocused()) return;

      // navigate, not push: while the lookup runs, a second tap must not stack
      // the screen twice.
      navigateToTab(
        isFlow(status, id)
          ? "/(app)/(tabs)/(flow)"
          : "/(app)/(tabs)/(library)/playlists",
      );
    },
    [navigateToTab, navigation, queryClient],
  );
}
