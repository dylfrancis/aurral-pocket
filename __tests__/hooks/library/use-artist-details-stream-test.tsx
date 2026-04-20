import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({
    serverUrl: "http://example.test",
    token: "test-token",
  })),
}));

jest.mock("@/lib/sse", () => ({
  streamSSE: jest.fn(),
}));

import { streamSSE } from "@/lib/sse";
import { useArtistDetailsStream } from "@/hooks/library/use-artist-details-stream";
import type { SSEEvent } from "@/lib/sse";

const mockStreamSSE = streamSSE as jest.Mock;

type EventQueue = {
  push: (evt: SSEEvent) => void;
  close: () => void;
  error: (err: Error) => void;
};

function makeControllableStream(): EventQueue {
  const queue: (SSEEvent | Error | "__done__")[] = [];
  const waiters: ((value: {
    done: boolean;
    error?: Error;
    value?: SSEEvent;
  }) => void)[] = [];

  const nextItem = () =>
    new Promise<{ done: boolean; error?: Error; value?: SSEEvent }>(
      (resolve) => {
        if (queue.length > 0) {
          const item = queue.shift()!;
          if (item === "__done__") return resolve({ done: true });
          if (item instanceof Error)
            return resolve({ done: true, error: item });
          return resolve({ done: false, value: item });
        }
        waiters.push(resolve);
      },
    );

  mockStreamSSE.mockImplementation(async function* () {
    while (true) {
      const { done, error, value } = await nextItem();
      if (error) throw error;
      if (done) return;
      yield value!;
    }
  });

  const resolveNext = (item: SSEEvent | Error | "__done__") => {
    const w = waiters.shift();
    if (w) {
      if (item === "__done__") return w({ done: true });
      if (item instanceof Error) return w({ done: true, error: item });
      return w({ done: false, value: item });
    }
    queue.push(item);
  };

  return {
    push: (evt) => resolveNext(evt),
    close: () => resolveNext("__done__"),
    error: (err) => resolveNext(err),
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useArtistDetailsStream", () => {
  it("is disabled when mbid is undefined", () => {
    const { result } = renderHook(() => useArtistDetailsStream(undefined), {
      wrapper,
    });

    expect(mockStreamSSE).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("starts with isComplete=false before any event", async () => {
    makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await waitFor(() => expect(mockStreamSSE).toHaveBeenCalled());
    expect(result.current.data).toBeUndefined();
  });

  it("exposes tags, bio, release-groups as undefined when no chunks have landed", async () => {
    makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await waitFor(() => expect(mockStreamSSE).toHaveBeenCalled());
    expect(result.current.data?.tags).toBeUndefined();
    expect(result.current.data?.bio).toBeUndefined();
    expect(result.current.data?.releaseGroups).toBeUndefined();
  });

  it("keeps isComplete=false when backend sends placeholder artist event", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.push({
        event: "artist",
        data: JSON.stringify({
          tags: [],
          "release-groups": [],
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.data?.tags).toEqual([]);
    });
    expect(result.current.data?.isComplete).toBe(false);
  });

  it("flips isComplete to true on the 'complete' event", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.push({
        event: "artist",
        data: JSON.stringify({
          tags: [{ name: "rock", count: 10 }],
          "release-groups": [],
        }),
      });
      stream.push({ event: "complete", data: "{}" });
      stream.close();
    });

    await waitFor(() => expect(result.current.data?.isComplete).toBe(true));
    expect(result.current.data?.tags).toEqual([{ name: "rock", count: 10 }]);
  });

  it("flips isComplete to true when the stream ends without a complete event", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.push({
        event: "artist",
        data: JSON.stringify({ tags: [] }),
      });
      stream.close();
    });

    await waitFor(() => expect(result.current.data?.isComplete).toBe(true));
  });

  it("flips isComplete to true when the stream errors", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.error(new Error("network"));
    });

    await waitFor(() => expect(result.current.data?.isComplete).toBe(true));
  });

  it("merges successive artist events", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.push({
        event: "artist",
        data: JSON.stringify({ tags: [{ name: "rock", count: 1 }] }),
      });
    });
    await waitFor(() => {
      expect(result.current.data?.tags).toEqual([{ name: "rock", count: 1 }]);
    });
    expect(result.current.data?.releaseGroups).toBeUndefined();

    await act(async () => {
      stream.push({
        event: "artist",
        data: JSON.stringify({
          "release-groups": [
            {
              id: "rg-1",
              title: "Album",
              "first-release-date": "2020-01-01",
              "primary-type": "Album",
              "secondary-types": [],
            },
          ],
        }),
      });
    });
    await waitFor(() => {
      expect(result.current.data?.releaseGroups).toHaveLength(1);
    });
    expect(result.current.data?.tags).toEqual([{ name: "rock", count: 1 }]);
    expect(result.current.data?.releaseGroups?.[0].id).toBe("rg-1");
  });

  it("ignores non-artist, non-complete events", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.push({ event: "cover", data: JSON.stringify({ images: [] }) });
      stream.push({ event: "similar", data: JSON.stringify({ artists: [] }) });
      stream.push({
        event: "artist",
        data: JSON.stringify({ bio: "A bio" }),
      });
    });

    await waitFor(() => expect(result.current.data?.bio).toBe("A bio"));
    expect(result.current.data?.tags).toBeUndefined();
    expect(result.current.data?.releaseGroups).toBeUndefined();
  });

  it("swallows malformed JSON without rejecting the query", async () => {
    const stream = makeControllableStream();

    const { result } = renderHook(() => useArtistDetailsStream("mbid-1"), {
      wrapper,
    });

    await act(async () => {
      stream.push({ event: "artist", data: "not-json" });
      stream.push({
        event: "artist",
        data: JSON.stringify({ tags: [{ name: "indie", count: 5 }] }),
      });
    });

    await waitFor(() => {
      expect(result.current.data?.tags).toEqual([{ name: "indie", count: 5 }]);
    });
    expect(result.current.error).toBeNull();
  });

  it("passes Authorization header when token is set", async () => {
    makeControllableStream();

    renderHook(() => useArtistDetailsStream("mbid-1"), { wrapper });

    await waitFor(() => expect(mockStreamSSE).toHaveBeenCalled());
    const [, options] = mockStreamSSE.mock.calls[0];
    expect(options.headers).toEqual({ Authorization: "Bearer test-token" });
  });

  it("does not put the token in the URL", async () => {
    makeControllableStream();

    renderHook(() => useArtistDetailsStream("mbid-1"), { wrapper });

    await waitFor(() => expect(mockStreamSSE).toHaveBeenCalled());
    const [url] = mockStreamSSE.mock.calls[0];
    expect(url).not.toContain("token=");
  });
});
