import { useMemo } from "react";
import { useFlowStatus, usePlaylistJobs } from "./use-flow-status";
import type { FlowJob, SharedPlaylist } from "@/lib/types/flow";

export function useSharedPlaylists(): SharedPlaylist[] {
  const { data } = useFlowStatus();
  return data?.sharedPlaylists ?? [];
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
