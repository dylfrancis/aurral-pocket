import { useFlowStatus } from "./use-flow-status";
import type { SharedPlaylist } from "@/lib/types/flow";

export function useSharedPlaylists(): SharedPlaylist[] {
  const { data } = useFlowStatus();
  return data?.sharedPlaylists ?? [];
}
