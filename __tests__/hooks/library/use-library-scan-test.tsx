jest.mock("@/lib/api/library", () => ({
  refreshCanonicalLibrary: jest.fn(),
  getCanonicalLibraryRefresh: jest.fn(),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import {
  refreshCanonicalLibrary,
  getCanonicalLibraryRefresh,
} from "@/lib/api/library";
import { useLibraryScan } from "@/hooks/library/use-library-scan";

const mockRefresh = refreshCanonicalLibrary as jest.Mock;
const mockStatus = getCanonicalLibraryRefresh as jest.Mock;
const mockToast = Burnt.toast as jest.Mock;

const COPY = {
  started: "Rescanning ABBA",
  done: "Rescanned ABBA",
  failed: "Couldn't rescan ABBA",
};

const clients: QueryClient[] = [];

function makeWrapper() {
  // gcTime 0 on mutations too: their default is five minutes, and the GC
  // timer re-arms on unmount after the afterEach clear, so a mutation kept
  // the jest process alive for five minutes after the suite passed.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  clients.push(client);
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, client };
}

const queued = (jobId: number) => ({
  queued: true,
  jobId,
  status: { jobId, status: "queued", error: null },
});

beforeEach(() => {
  jest.clearAllMocks();
});

// An unfinished scan keeps a poll timer alive. Clear it so the worker exits.
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

it("polls the scan until it completes, then rereads the Library and says so", async () => {
  mockRefresh.mockResolvedValue(queued(2));
  mockStatus.mockResolvedValue({ jobId: 2, status: "completed", error: null });
  const { wrapper, client } = makeWrapper();
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const { result } = await renderHook(() => useLibraryScan(), { wrapper });

  await act(async () => {
    result.current.scan({ artistId: 7 }, COPY);
  });
  await waitFor(() => expect(result.current.isScanning).toBe(false));

  expect(mockRefresh.mock.calls[0][0]).toEqual({ artistId: 7 });
  expect(mockStatus).toHaveBeenCalledWith(2);
  expect(mockToast.mock.calls.map(([toast]) => toast.title)).toEqual([
    "Rescanning ABBA",
    "Rescanned ABBA",
  ]);
  // The poll lives under the same "library" prefix, so the reread must skip
  // it or the finished scan would restart its own poll.
  const predicate = invalidate.mock.calls[0][0]!.predicate!;
  expect(predicate({ queryKey: ["library", "artists"] } as never)).toBe(true);
  // Play reads the queue, so new files have to reach it.
  expect(
    predicate({ queryKey: ["library", "artistQueue", "mb-1"] } as never),
  ).toBe(true);
  expect(predicate({ queryKey: ["library", "refresh", 2] } as never)).toBe(
    false,
  );
});

it("says the scan failed when the server reports it", async () => {
  mockRefresh.mockResolvedValue(queued(3));
  mockStatus.mockResolvedValue({
    jobId: 3,
    status: "failed",
    error: "Disk unavailable",
  });
  const { wrapper } = makeWrapper();
  const { result } = await renderHook(() => useLibraryScan(), { wrapper });

  await act(async () => {
    result.current.scan({ mode: "quick" }, COPY);
  });
  await waitFor(() => expect(result.current.isScanning).toBe(false));

  expect(mockToast).toHaveBeenLastCalledWith({
    title: "Couldn't rescan ABBA",
    message: "Disk unavailable",
    preset: "error",
  });
});

it("says so when the server won't start the scan, and polls nothing", async () => {
  mockRefresh.mockRejectedValue(new Error("No files to rescan"));
  const { wrapper } = makeWrapper();
  const { result } = await renderHook(() => useLibraryScan(), { wrapper });

  await act(async () => {
    result.current.scan({ artistId: 7 }, COPY);
  });
  await waitFor(() => expect(result.current.isScanning).toBe(false));

  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast).toHaveBeenCalledWith({
    title: "Couldn't rescan ABBA",
    message: "No files to rescan",
    preset: "error",
  });
  expect(mockStatus).not.toHaveBeenCalled();
});
