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
