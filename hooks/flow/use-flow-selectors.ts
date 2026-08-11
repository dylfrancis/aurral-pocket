import { useMemo } from "react";
import { useFlowStatus, usePlaylistJobs } from "./use-flow-status";
import type {
  Flow,
  FlowJob,
  PlaylistStats,
  SharedPlaylist,
} from "@/lib/types/flow";

export function useFlows(): Flow[] {
  const { data } = useFlowStatus();
  return data?.flows ?? [];
}

export function useFlow(flowId: string | undefined): Flow | undefined {
  const flows = useFlows();
  return useMemo(
    () => (flowId ? flows.find((f) => f.id === flowId) : undefined),
    [flowId, flows],
  );
}

export function useSharedPlaylists(): SharedPlaylist[] {
  const { data } = useFlowStatus();
  return data?.sharedPlaylists ?? [];
}

export function useSharedPlaylist(
  playlistId: string | undefined,
): SharedPlaylist | undefined {
  const playlists = useSharedPlaylists();
  return useMemo(
    () => (playlistId ? playlists.find((p) => p.id === playlistId) : undefined),
    [playlistId, playlists],
  );
}

export function useJobsForPlaylist(
  playlistId: string | undefined,
  { includeFailed = false }: { includeFailed?: boolean } = {},
): FlowJob[] {
  const { data } = usePlaylistJobs(playlistId);
  return useMemo(() => {
    if (!data) return [];
    if (includeFailed) return data;
    return data.filter((job) => job.status !== "failed");
  }, [data, includeFailed]);
}

export function useFlowStats(
  flowId: string | undefined,
): PlaylistStats | undefined {
  const { data } = useFlowStatus();
  if (!flowId) return undefined;
  return data?.flowStats?.[flowId];
}

export function usePlaylistStats(
  playlistId: string | undefined,
): PlaylistStats | undefined {
  const { data } = useFlowStatus();
  if (!playlistId) return undefined;
  return data?.sharedPlaylistStats?.[playlistId];
}

export function useRetryCyclePaused(playlistId: string | undefined): boolean {
  const { data } = useFlowStatus();
  if (!playlistId) return false;
  return !!data?.retryCyclePausedByPlaylist?.[playlistId];
}
