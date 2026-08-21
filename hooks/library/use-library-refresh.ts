import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCanonicalLibraryRefresh,
  refreshCanonicalLibrary,
} from "@/lib/api/library";
import { libraryKeys } from "@/lib/query-keys";

const POLL_INTERVAL_MS = 3000;

const isFinished = (status?: string) =>
  status === "completed" || status === "failed";

/**
 * Queue a rescan of the canonical library, then poll it until it finishes.
 *
 * The scan runs on the server, so the job outlives the screen that started it.
 * Polling stops on "completed" or "failed". A finished scan invalidates the
 * library queries so the screens pick up the new records.
 *
 * The scan endpoints arrived with the canonical library in server 2.5.0. Older
 * servers answer 404, which surfaces as an error on the mutation.
 */
export function useLibraryRefresh() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: refreshCanonicalLibrary,
    onSuccess: (job) => setJobId(job.jobId),
  });

  const { data: status, error: statusError } = useQuery({
    queryKey: libraryKeys.refresh(jobId!),
    queryFn: async () => {
      const next = await getCanonicalLibraryRefresh(jobId!);
      if (isFinished(next.status)) {
        // Invalidate the library data, but not this poll. The refresh key
        // sits under the same "library" prefix, so a prefix invalidation
        // would restart the poll it just finished.
        await queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "library" && query.queryKey[1] !== "refresh",
        });
      }
      return next;
    },
    enabled: !!jobId,
    retry: false,
    // Stop on a finished scan, and on a failed read. The server answers 404
    // for a job it does not know, and for every server older than 2.5.0.
    // Without this the poll would repeat that 404 forever.
    refetchInterval: (query) =>
      query.state.error || isFinished(query.state.data?.status)
        ? false
        : POLL_INTERVAL_MS,
  });

  const reset = useCallback(() => setJobId(null), []);

  return {
    start: start.mutate,
    startAsync: start.mutateAsync,
    isStarting: start.isPending,
    /** The error from queueing the scan, or from reading its status. */
    error: start.error ?? statusError,
    jobId,
    status,
    isScanning: !!jobId && !statusError && !isFinished(status?.status),
    reset,
  };
}
