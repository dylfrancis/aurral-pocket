import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  adoptDiscoverPlaylistAsFlow,
  adoptDiscoverPlaylistAsStatic,
  type AdoptDiscoverFlowResponse,
  type AdoptDiscoverStaticResponse,
} from "@/lib/api/search";
import { discoverKeys, flowKeys } from "@/lib/query-keys";

type AdoptKind = "flow" | "static";
type AdoptResponse = AdoptDiscoverFlowResponse | AdoptDiscoverStaticResponse;
type AdoptVariables = { presetId: string; kind: AdoptKind };

/**
 * Adopt a discover playlist preset as a rotating Flow or a static playlist.
 * On success we refetch discovery (so the card picks up the server-assigned
 * adoptedFlowId / adoptedPlaylistId) and the flow status. The backend rejects
 * adoption with a 400 when slskd isn't configured — its message is surfaced
 * verbatim in the error toast.
 */
export function useAdoptDiscoverPlaylist() {
  const queryClient = useQueryClient();

  const mutation = useMutation<AdoptResponse, Error, AdoptVariables>({
    mutationFn: ({ presetId, kind }) =>
      kind === "flow"
        ? adoptDiscoverPlaylistAsFlow(presetId)
        : adoptDiscoverPlaylistAsStatic(presetId),
    onSuccess: (_data, { kind }) => {
      void queryClient.invalidateQueries({
        queryKey: discoverKeys.discovery(),
      });
      void queryClient.invalidateQueries({ queryKey: flowKeys.status() });
      Burnt.toast({
        title:
          kind === "flow"
            ? "Added as a rotating flow"
            : "Added as a static playlist",
        preset: "done",
      });
    },
    onError: (err) => {
      Burnt.toast({
        title: "Couldn't add playlist",
        message: err instanceof Error ? err.message : "Please try again.",
        preset: "error",
      });
    },
  });

  return mutation;
}
