import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlocklist, updateBlocklist } from "@/lib/api/discover";
import {
  addTagToBlocklist,
  isArtistBlocked,
  normalizeBlocklist,
  removeArtistFromBlocklist,
  removeTagFromBlocklist,
  toggleArtistInBlocklist,
} from "@/lib/blocklist";
import { discoverKeys } from "@/lib/query-keys";
import type { BlockedArtist, Blocklist } from "@/lib/types/discover";

const EMPTY: Blocklist = { artists: [], tags: [] };

export function useBlocklist() {
  return useQuery({
    queryKey: discoverKeys.blocklist(),
    queryFn: getBlocklist,
    staleTime: 5 * 60 * 1000,
  });
}

type Variables =
  | { kind: "toggleArtist"; artist: BlockedArtist }
  | { kind: "removeArtist"; artist: BlockedArtist }
  | { kind: "addTag"; tag: string }
  | { kind: "removeTag"; tag: string };

type MutationContext = { previous: Blocklist | undefined };

function applyVariables(current: Blocklist, vars: Variables): Blocklist {
  switch (vars.kind) {
    case "toggleArtist":
      return toggleArtistInBlocklist(current, vars.artist);
    case "removeArtist":
      return removeArtistFromBlocklist(current, vars.artist);
    case "addTag":
      return addTagToBlocklist(current, vars.tag);
    case "removeTag":
      return removeTagFromBlocklist(current, vars.tag);
  }
}

export function useBlocklistMutations() {
  const queryClient = useQueryClient();

  const mutation = useMutation<Blocklist, Error, Variables, MutationContext>({
    mutationFn: async (vars) => {
      const current =
        queryClient.getQueryData<Blocklist>(discoverKeys.blocklist()) ?? EMPTY;
      const next = applyVariables(current, vars);
      return updateBlocklist(next);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: discoverKeys.blocklist() });
      const previous = queryClient.getQueryData<Blocklist>(
        discoverKeys.blocklist(),
      );
      const current = previous ?? EMPTY;
      queryClient.setQueryData<Blocklist>(
        discoverKeys.blocklist(),
        normalizeBlocklist(applyVariables(current, vars)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(discoverKeys.blocklist(), context.previous);
      }
    },
    onSuccess: (server) => {
      queryClient.setQueryData(discoverKeys.blocklist(), server);
    },
  });

  const toggleArtist = useCallback(
    (artist: BlockedArtist) =>
      mutation.mutate({ kind: "toggleArtist", artist }),
    [mutation],
  );
  const removeArtist = useCallback(
    (artist: BlockedArtist) =>
      mutation.mutate({ kind: "removeArtist", artist }),
    [mutation],
  );
  const addTag = useCallback(
    (tag: string) => mutation.mutate({ kind: "addTag", tag }),
    [mutation],
  );
  const removeTag = useCallback(
    (tag: string) => mutation.mutate({ kind: "removeTag", tag }),
    [mutation],
  );

  return {
    toggleArtist,
    removeArtist,
    addTag,
    removeTag,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/** Convenience selector — keeps callers from repeating the isBlocked check. */
export function useIsArtistBlocked(
  mbid: string | null | undefined,
  name: string | null | undefined,
): { blocked: boolean; loaded: boolean } {
  const { data } = useBlocklist();
  return {
    blocked: isArtistBlocked(mbid, name, data),
    loaded: data !== undefined,
  };
}
