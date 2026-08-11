import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  flowStatusQueryOptions,
  playlistJobsQueryOptions,
} from "./use-flow-status";
import type {
  FlowJob,
  FlowStatusSnapshot,
  SharedPlaylist,
} from "@/lib/types/flow";

type Result<T> = {
  snapshot: T | undefined;
  isLoading: boolean;
};

/**
 * Resolves the entity being edited from the flow status cache exactly once,
 * with a one-shot fetch fallback for cold starts (deep links).
 *
 * Edit screens must not subscribe to the polling status query: a poll-tick
 * re-render mid-gesture snaps the iOS hour wheel back to the stale value
 * (#138), and a background refetch must never reset an in-progress draft.
 */
export function useEditSnapshot<T>(
  enabled: boolean,
  select: (status: FlowStatusSnapshot) => T | undefined,
): Result<T> {
  const queryClient = useQueryClient();
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });

  const [state, setState] = useState<Result<T>>(() => {
    if (!enabled) return { snapshot: undefined, isLoading: false };
    const cached = queryClient.getQueryData<FlowStatusSnapshot>(
      flowStatusQueryOptions().queryKey,
    );
    if (cached) return { snapshot: select(cached), isLoading: false };
    return { snapshot: undefined, isLoading: true };
  });

  useEffect(() => {
    if (!state.isLoading) return;
    let cancelled = false;
    queryClient
      .ensureQueryData(flowStatusQueryOptions())
      .then((status) => {
        if (cancelled) return;
        setState({ snapshot: selectRef.current(status), isLoading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ snapshot: undefined, isLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient, state.isLoading]);

  return state;
}

export type PlaylistEditSnapshot = {
  playlist: SharedPlaylist;
  jobs: FlowJob[];
};

function selectPlaylistEditSnapshot(
  playlistId: string,
  status: FlowStatusSnapshot,
  jobs: FlowJob[],
): PlaylistEditSnapshot | undefined {
  const playlist = status.sharedPlaylists.find((p) => p.id === playlistId);
  if (!playlist) return undefined;
  return { playlist, jobs: jobs.filter((job) => job.status !== "failed") };
}

/**
 * One-time snapshot of a shared playlist plus its track jobs. Same
 * no-live-subscription contract as useEditSnapshot; the jobs come from a
 * second query because the status snapshot does not carry them.
 */
export function usePlaylistEditSnapshot(
  playlistId: string | null,
): Result<PlaylistEditSnapshot> {
  const queryClient = useQueryClient();

  const [state, setState] = useState<Result<PlaylistEditSnapshot>>(() => {
    if (!playlistId) return { snapshot: undefined, isLoading: false };
    const status = queryClient.getQueryData<FlowStatusSnapshot>(
      flowStatusQueryOptions().queryKey,
    );
    const jobs = queryClient.getQueryData<FlowJob[]>(
      playlistJobsQueryOptions(playlistId).queryKey,
    );
    if (status && jobs) {
      return {
        snapshot: selectPlaylistEditSnapshot(playlistId, status, jobs),
        isLoading: false,
      };
    }
    return { snapshot: undefined, isLoading: true };
  });

  useEffect(() => {
    if (!state.isLoading || !playlistId) return;
    let cancelled = false;
    Promise.all([
      queryClient.ensureQueryData(flowStatusQueryOptions()),
      queryClient.ensureQueryData(playlistJobsQueryOptions(playlistId)),
    ])
      .then(([status, jobs]) => {
        if (cancelled) return;
        setState({
          snapshot: selectPlaylistEditSnapshot(playlistId, status, jobs),
          isLoading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ snapshot: undefined, isLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient, state.isLoading, playlistId]);

  return state;
}
