import { useEffect } from "react";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { getCanonicalLibraryPage } from "@/lib/api/library";
import { flowKeys } from "@/lib/query-keys";
import type { FlowStatusSnapshot } from "@/lib/types/flow";
import {
  isSiriAvailable,
  setLibrarySize,
  setPlaylistNames,
} from "@/modules/siri";

const FLOW_STATUS_HASH = hashKey(flowKeys.status());

/**
 * Tells Siri the playlist and flow names its catalog can't know, and the
 * Library's size, so it sends music requests here. The names follow the
 * playlist status whenever it loads; this doesn't load it.
 */
export function useSiriVocabulary(): void {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id;

  useEffect(() => {
    if (!isSiriAvailable) return;
    let taught = "";
    const teach = (status: FlowStatusSnapshot | undefined) => {
      if (!status) return;
      const names = [
        ...new Set([
          ...status.staticPlaylists.map((playlist) => playlist.name),
          ...status.flows.map((flow) => flow.name),
        ]),
      ];
      const key = names.join("\n");
      if (key === taught) return;
      taught = key;
      setPlaylistNames(names);
    };
    teach(queryClient.getQueryData(flowKeys.status()));
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      if (event.query.queryHash !== FLOW_STATUS_HASH) return;
      teach(event.query.state.data as FlowStatusSnapshot | undefined);
    });
  }, [queryClient]);

  useEffect(() => {
    if (!isSiriAvailable || userId === undefined) return;
    getCanonicalLibraryPage({
      kind: "tracks",
      source: "all",
      availableOnly: true,
      pageSize: 1,
    })
      .then((page) => setLibrarySize(page.total))
      .catch(() => {});
  }, [userId]);
}
