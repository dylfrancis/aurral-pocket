import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { cancelAurralAlbum } from "@/lib/api/library";
import { activityKeys, libraryKeys } from "@/lib/query-keys";

export function useCancelAurralAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (canonicalId: string) => cancelAurralAlbum(canonicalId),
    // The sheet closes either way, so only this says the stop failed.
    onError: () => {
      Burnt.toast({ title: "Couldn't stop the download", preset: "error" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: activityKeys.downloadStatusesAll(),
      });
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.downloadStatusesAll(),
      });
    },
  });
}
