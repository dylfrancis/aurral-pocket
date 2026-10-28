jest.mock("@/lib/api/client", () => ({
  ApiError: jest.requireActual("@/lib/api/client").ApiError,
  api: {
    defaults: { baseURL: "https://example.com/api" },
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("burnt", () => ({ toast: jest.fn() }));

import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { api, ApiError } from "@/lib/api/client";
import {
  useSetFlowEnabled,
  useSetRetryCyclePaused,
  useStartFlow,
} from "@/hooks/flow/use-flow-mutations";
import type { FlowJob } from "@/lib/types/flow";

const mockGet = api.get as jest.Mock;
const mockPut = api.put as jest.Mock;
const mockPost = api.post as jest.Mock;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

function job(id: string, status: FlowJob["status"]): FlowJob {
  return {
    id,
    playlistType: "pl-1",
    artistName: "Slowdive",
    trackName: id,
    albumName: null,
    artistMbid: null,
    status,
  };
}

const OK = { data: { success: true }, status: 200 };

beforeEach(() => {
  jest.clearAllMocks();
  mockPut.mockResolvedValue(OK);
  mockPost.mockResolvedValue(OK);
});

describe("useSetRetryCyclePaused", () => {
  it("requeues the playlist's failed tracks after resuming, even when the server refuses one", async () => {
    mockGet.mockResolvedValue({
      data: [
        job("job-1", "failed"),
        job("job-2", "done"),
        job("job-3", "failed"),
        job("job-4", "pending"),
      ],
      status: 200,
    });
    mockPost.mockImplementation((path: string) =>
      path.includes("job-3")
        ? Promise.reject(new ApiError(409, "Track is already being processed"))
        : Promise.resolve(OK),
    );
    const { result } = await renderHook(() => useSetRetryCyclePaused(), {
      wrapper: makeWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({ playlistId: "pl-1", paused: false }),
    );

    expect(mockPut).toHaveBeenCalledWith(
      "/playlists/playlists/pl-1/retry-cycle",
      { paused: false },
    );
    expect(mockPost.mock.calls.map(([path]) => path)).toEqual([
      "/playlists/shared-playlists/pl-1/tracks/job-1/research",
      "/playlists/shared-playlists/pl-1/tracks/job-3/research",
    ]);
    expect(Burnt.toast).not.toHaveBeenCalled();
  });

  it("reports a requeue failure that is not a per-track refusal", async () => {
    mockGet.mockResolvedValue({
      data: [job("job-1", "failed")],
      status: 200,
    });
    mockPost.mockRejectedValue(
      new ApiError(0, "Unable to reach server. Check your connection."),
    );
    const { result } = await renderHook(() => useSetRetryCyclePaused(), {
      wrapper: makeWrapper(),
    });

    await act(() =>
      result.current
        .mutateAsync({ playlistId: "pl-1", paused: false })
        .catch(() => {}),
    );

    expect(Burnt.toast).toHaveBeenCalledWith({
      title: "Couldn't resume retries",
      message: "Unable to reach server. Check your connection.",
      preset: "error",
    });
  });

  it("requeues nothing when pausing", async () => {
    const { result } = await renderHook(() => useSetRetryCyclePaused(), {
      wrapper: makeWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({ playlistId: "pl-1", paused: true }),
    );

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("flow error toasts", () => {
  const RETIRED = "This flow's source was retired, so it no longer updates";

  it.each([
    {
      name: "Start",
      request: mockPost,
      useAction: () => {
        const { mutateAsync } = useStartFlow();
        return () => mutateAsync({ flowId: "flow-1" });
      },
      title: "Couldn't start flow",
    },
    {
      name: "the enable toggle",
      request: mockPut,
      useAction: () => {
        const { mutateAsync } = useSetFlowEnabled();
        return () => mutateAsync({ flowId: "flow-1", enabled: true });
      },
      title: "Couldn't turn on flow",
    },
  ])(
    "shows the server's message when $name fails",
    async ({ request, useAction, title }) => {
      request.mockRejectedValue(new ApiError(409, RETIRED));
      const { result } = await renderHook(() => useAction(), {
        wrapper: makeWrapper(),
      });

      await act(() => result.current().catch(() => {}));

      expect(Burnt.toast).toHaveBeenCalledWith({
        title,
        message: RETIRED,
        preset: "error",
      });
    },
  );
});
