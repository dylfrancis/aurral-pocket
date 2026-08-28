jest.mock("@/lib/api/me", () => ({
  getMyListeningHistory: jest.fn(),
  updateMyListeningHistory: jest.fn(),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: { id: 7, username: "thom", role: "user" },
    serverUrl: "https://test.example",
    token: "test-token-123",
  })),
}));

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateListeningHistory } from "@/hooks/me/use-listening-history";
import { updateMyListeningHistory } from "@/lib/api/me";
import { meKeys } from "@/lib/query-keys";
import type { ListenHistorySettings } from "@/lib/types/me";

const mockUpdate = updateMyListeningHistory as jest.Mock;

const clients: QueryClient[] = [];

function makeWrapper() {
  // The cached settings have no observer here — the test writes them and the
  // mutation rewrites them. A zero gcTime collects them the moment the
  // mutation flushes, leaving nothing to assert on.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
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

function cached(client: QueryClient) {
  return client.getQueryData<ListenHistorySettings>(meKeys.listeningHistory());
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe("useUpdateListeningHistory", () => {
  // Moving to "local" clears the username on the server. Keeping the old one
  // would put an account name back on screen that the server no longer has.
  it("clears the cached username the server answered as empty", async () => {
    const { wrapper, client } = makeWrapper();
    client.setQueryData<ListenHistorySettings>(meKeys.listeningHistory(), {
      listenHistoryProvider: "lastfm",
      listenHistoryUsername: "thom",
      lastfmUsername: "thom",
      listenHistoryUrl: null,
    });
    mockUpdate.mockResolvedValue({
      listenHistoryProvider: "local",
      listenHistoryUsername: null,
      lastfmUsername: null,
      listenHistoryUrl: null,
    });

    const { result } = await renderHook(() => useUpdateListeningHistory(), {
      wrapper,
    });
    await act(() =>
      result.current.mutateAsync({
        listenHistoryProvider: "local",
        listenHistoryUsername: null,
      }),
    );

    await waitFor(() =>
      expect(cached(client)).toEqual({
        listenHistoryProvider: "local",
        listenHistoryUsername: null,
        lastfmUsername: null,
        listenHistoryUrl: null,
      }),
    );
  });

  // A key the response leaves out says nothing about the setting.
  it("keeps what it had for a setting the response omits", async () => {
    const { wrapper, client } = makeWrapper();
    client.setQueryData<ListenHistorySettings>(meKeys.listeningHistory(), {
      listenHistoryProvider: "koito",
      listenHistoryUsername: null,
      lastfmUsername: null,
      listenHistoryUrl: "https://koito.example",
    });
    mockUpdate.mockResolvedValue({
      listenHistoryProvider: "listenbrainz",
      listenHistoryUsername: "thom",
    });

    const { result } = await renderHook(() => useUpdateListeningHistory(), {
      wrapper,
    });
    await act(() =>
      result.current.mutateAsync({
        listenHistoryProvider: "listenbrainz",
        listenHistoryUsername: "thom",
      }),
    );

    await waitFor(() =>
      expect(cached(client)?.listenHistoryUrl).toBe("https://koito.example"),
    );
  });
});
