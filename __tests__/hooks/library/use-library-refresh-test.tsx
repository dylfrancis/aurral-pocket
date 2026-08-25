jest.mock("@/lib/api/library", () => ({
  refreshCanonicalLibrary: jest.fn(),
  getCanonicalLibraryRefresh: jest.fn(),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  refreshCanonicalLibrary,
  getCanonicalLibraryRefresh,
} from "@/lib/api/library";
import { useLibraryRefresh } from "@/hooks/library/use-library-refresh";

const mockRefresh = refreshCanonicalLibrary as jest.Mock;
const mockStatus = getCanonicalLibraryRefresh as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
});

// An unfinished scan keeps a poll timer alive. Clear it so the worker exits.
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe("useLibraryRefresh", () => {
  it("does not poll before a scan is queued", async () => {
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryRefresh(), {
      wrapper,
    });

    expect(result.current.isScanning).toBe(false);
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it("polls the job the server returned", async () => {
    mockRefresh.mockResolvedValue({
      queued: true,
      jobId: 1,
      status: { jobId: 1, status: "queued", error: null },
    });
    mockStatus.mockResolvedValue({ jobId: 1, status: "running", error: null });

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryRefresh(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startAsync();
    });

    await waitFor(() => expect(result.current.status?.status).toBe("running"));
    expect(mockStatus).toHaveBeenCalledWith(1);
    expect(result.current.isScanning).toBe(true);
  });

  it("stops scanning and refreshes the library once the scan completes", async () => {
    mockRefresh.mockResolvedValue({
      queued: true,
      jobId: 2,
      status: { jobId: 2, status: "queued", error: null },
    });
    mockStatus.mockResolvedValue({
      jobId: 2,
      status: "completed",
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useLibraryRefresh(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startAsync();
    });

    await waitFor(() => expect(result.current.isScanning).toBe(false));

    // The poll lives under the same "library" prefix, so the invalidation
    // must skip it or the finished scan would restart its own poll.
    const [call] = invalidate.mock.calls;
    const predicate = call[0]!.predicate!;
    expect(predicate({ queryKey: ["library", "artists"] } as never)).toBe(true);
    expect(predicate({ queryKey: ["library", "refresh", 2] } as never)).toBe(
      false,
    );
  });

  it("surfaces the error when the server has no scan endpoint", async () => {
    mockRefresh.mockRejectedValue(new Error("Not Found"));

    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useLibraryRefresh(), {
      wrapper,
    });

    await act(async () => {
      await result.current.startAsync().catch(() => {});
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.jobId).toBeNull();
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
