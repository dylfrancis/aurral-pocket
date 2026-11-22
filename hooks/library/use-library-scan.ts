import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { invalidateLibraryIndex } from "@/hooks/library/library-lists";
import {
  getCanonicalLibraryRefresh,
  refreshCanonicalLibrary,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";
import type { LibraryScanScope, LibraryScanStatus } from "@/lib/types/library";

const POLL_INTERVAL_MS = 3000;

const isFinished = (status?: LibraryScanStatus["status"]) =>
  status === "completed" || status === "failed";

/** Android shows only a toast's title, so each one says what happened. */
export type ScanToasts = { started?: string; done: string; failed: string };

/**
 * Queue a scan and poll it, then reread the Library, since the live socket can
 * be down. The closing toast shows only while the screen is open.
 */
export function useLibraryScan() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const toasts = useRef<ScanToasts | null>(null);

  const start = useMutation({
    mutationFn: refreshCanonicalLibrary,
    onSuccess: (job) => setJobId(job.jobId),
  });

  const { data: status, error: statusError } = useQuery({
    queryKey: libraryKeys.refresh(jobId ?? 0),
    queryFn: () => getCanonicalLibraryRefresh(jobId!),
    enabled: jobId != null,
    retry: false,
    // A failed read stops too: the server answers 404 for a job it forgot.
    refetchInterval: (query) =>
      query.state.error || isFinished(query.state.data?.status)
        ? false
        : POLL_INTERVAL_MS,
  });

  const finished = isFinished(status?.status);
  useEffect(() => {
    if (!finished || !status) return;
    void invalidateLibraryIndex(queryClient);
    const copy = toasts.current;
    toasts.current = null;
    if (!copy) return;
    Burnt.toast(
      status.status === "completed"
        ? { title: copy.done, preset: "done" }
        : {
            title: copy.failed,
            message: status.error ?? undefined,
            preset: "error",
          },
    );
  }, [finished, status, queryClient]);

  const scan = useCallback(
    (scope: LibraryScanScope, copy: ScanToasts) => {
      toasts.current = copy;
      start.mutate(scope, {
        onSuccess: () => {
          if (copy.started)
            Burnt.toast({ title: copy.started, preset: "done" });
        },
        onError: (error) => {
          toasts.current = null;
          Burnt.toast({
            title: copy.failed,
            message: error instanceof Error ? error.message : undefined,
            preset: "error",
          });
        },
      });
    },
    [start],
  );

  return {
    scan,
    isScanning: start.isPending || (jobId != null && !statusError && !finished),
  };
}
