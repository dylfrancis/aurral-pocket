import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import {
  getArtistMonitoring,
  getMonitoringDefaults,
  setArtistMonitoring,
} from "@/lib/api/library";
import { ApiError } from "@/lib/api/client";
import { describeMonitoringPlan } from "@/lib/monitoring-rules";
import { libraryKeys } from "@/lib/query-keys";
import type {
  ArtistMonitoring,
  ArtistMonitoringChange,
  ArtistMonitoringState,
} from "@/lib/types/monitoring";

export function useMonitoringDefaults() {
  return useQuery({
    queryKey: libraryKeys.monitoringDefaults(),
    queryFn: getMonitoringDefaults,
  });
}

/** Another device or the web can change it, so it's read on every visit. */
export function useArtistMonitoring(mbid: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.artistMonitoring(mbid ?? ""),
    queryFn: () => getArtistMonitoring(mbid!),
    enabled: !!mbid,
    staleTime: 0,
  });
}

function nextState(
  previous: ArtistMonitoringState | undefined,
  change: ArtistMonitoringChange,
): ArtistMonitoringState | undefined {
  if (!previous) return previous;
  return {
    added: true,
    monitored: change.monitored,
    useDefault: change.useDefault ?? true,
    rules: change.rules ?? null,
    defaultRules: change.defaultRules ?? previous.defaultRules,
  };
}

/** Toasts what each change queued. */
export function useSetArtistMonitoring(mbid: string, artistName: string) {
  const queryClient = useQueryClient();
  const queryKey = libraryKeys.artistMonitoring(mbid);

  return useMutation({
    mutationFn: (monitoring: ArtistMonitoring) =>
      setArtistMonitoring(mbid, monitoring),
    onSuccess: (change) => {
      // The answer is the server's own reading, so it needs no refetch.
      queryClient.setQueryData<ArtistMonitoringState>(queryKey, (previous) =>
        nextState(previous, change),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Burnt.toast({
        // Short, so the iOS toast doesn't cut it off. The capsule shows which rules.
        title: change.monitored
          ? `Monitoring ${artistName}`
          : `Stopped monitoring ${artistName}`,
        message: change.monitored
          ? describeMonitoringPlan(change.monitoring, change.rules)
          : undefined,
        preset: "done",
      });
    },
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Burnt.toast({
        title: `Couldn't change monitoring for ${artistName}`,
        message: error instanceof ApiError ? error.message : undefined,
        preset: "error",
      });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
