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
import { flowKeys } from "@/lib/query-keys";
import {
  useConvertFlowToStaticPlaylist,
  useCreateFlow,
  useCreateFlowFromTemplate,
  useSetFlowEnabled,
  useSetRetryCyclePaused,
  useStartFlow,
  useUpdateFlow,
} from "@/hooks/flow/use-flow-mutations";
import type {
  FlowFormValues,
  FlowJob,
  FlowStatusSnapshot,
} from "@/lib/types/flow";

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
    albumMbid: null,
    trackMbid: null,
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
  const NOT_FOUND = "Flow not found";

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
      request.mockRejectedValue(new ApiError(404, NOT_FOUND));
      const { result } = await renderHook(() => useAction(), {
        wrapper: makeWrapper(),
      });

      await act(() => result.current().catch(() => {}));

      expect(Burnt.toast).toHaveBeenCalledWith({
        title,
        message: NOT_FOUND,
        preset: "error",
      });
    },
  );
});

describe("useConvertFlowToStaticPlaylist", () => {
  const convert = async () => {
    const { result } = await renderHook(
      () => useConvertFlowToStaticPlaylist(),
      { wrapper: makeWrapper() },
    );
    await act(() =>
      result.current
        .mutateAsync({ flowId: "flow-1", name: "Chill Static" })
        .catch(() => {}),
    );
  };

  it("says where the playlist went", async () => {
    mockPost.mockResolvedValue({
      data: { success: true, playlist: { id: "pl-1", name: "Chill Static" } },
      status: 200,
    });

    await convert();

    expect(Burnt.toast).toHaveBeenCalledWith({
      title: "Saved to Playlists in Library",
      message: "Chill Static",
      preset: "done",
    });
  });

  it("reports why a conversion failed", async () => {
    const reason = "Download at least one flow track before saving a playlist.";
    mockPost.mockRejectedValue(new ApiError(400, reason));

    await convert();

    expect(Burnt.toast).toHaveBeenCalledWith({
      title: "Couldn't save playlist",
      message: reason,
      preset: "error",
    });
  });
});

describe("useCreateFlowFromTemplate", () => {
  it("lists the new flow in the cached snapshot before the status refetch answers", async () => {
    // A finite gcTime leaves a timer on the seeded query that keeps Jest alive.
    const client = new QueryClient({
      defaultOptions: {
        queries: { gcTime: Infinity },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    client.setQueryData(flowKeys.status(), {
      flows: [{ id: "flow-1", name: "Chill" }],
    } as FlowStatusSnapshot);
    const created = { id: "flow-2", name: "Release Radar" };
    mockPost.mockResolvedValue({ data: { success: true, flow: created } });
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useCreateFlowFromTemplate(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(() => result.current.mutateAsync("release-radar"));

    expect(
      client.getQueryData<FlowStatusSnapshot>(flowKeys.status())?.flows,
    ).toEqual([{ id: "flow-1", name: "Chill" }, created]);
  });
});

describe("name conflicts", () => {
  const payload = { name: "Chill" } as FlowFormValues;

  async function saveError(useSave: () => () => Promise<unknown>) {
    const { result } = await renderHook(() => useSave(), {
      wrapper: makeWrapper(),
    });
    let error: Error | undefined;
    await act(async () => {
      await result.current().catch((err: Error) => {
        error = err;
      });
    });
    return error;
  }

  const useCreate = () => {
    const { mutateAsync } = useCreateFlow();
    return () => mutateAsync(payload);
  };

  it.each([
    {
      name: "creating a flow",
      request: mockPost,
      serverMessage: 'Flow name "Chill" already exists',
      useSave: useCreate,
    },
    {
      name: "creating a flow from a template",
      request: mockPost,
      serverMessage: 'Flow name "Chill" already exists',
      useSave: () => {
        const { mutateAsync } = useCreateFlowFromTemplate();
        return () => mutateAsync("discover-weekly");
      },
    },
    {
      name: "renaming a flow",
      request: mockPut,
      serverMessage: 'Flow name "Chill" already exists',
      useSave: () => {
        const { mutateAsync } = useUpdateFlow();
        return () => mutateAsync({ flowId: "flow-1", payload });
      },
    },
    {
      name: "converting a flow",
      request: mockPost,
      serverMessage: 'Playlist "Chill" already exists',
      useSave: () => {
        const { mutateAsync } = useConvertFlowToStaticPlaylist();
        return () => mutateAsync({ flowId: "flow-1", name: "Chill" });
      },
    },
  ])(
    "names both kinds when $name collides",
    async ({ request, serverMessage, useSave }) => {
      request.mockRejectedValue(new ApiError(400, serverMessage));

      const error = await saveError(useSave);

      expect(error?.message).toBe(
        '"Chill" is already used by a flow or a playlist.',
      );
    },
  );

  it("leaves other failures in the server's words", async () => {
    const reason = "scheduleDays must include at least one day";
    mockPost.mockRejectedValue(new ApiError(400, reason));

    const error = await saveError(useCreate);

    expect(error?.message).toBe(reason);
  });
});
