import { fetch as expoFetch } from "expo/fetch";
import { streamSSE } from "@/lib/sse";

const mockFetch = expoFetch as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

type ReaderStub = {
  read: jest.Mock;
  cancel: jest.Mock;
  releaseLock: jest.Mock;
};

function makeReader(chunks: (Uint8Array | Error)[]): ReaderStub {
  const queue = [...chunks];
  return {
    read: jest.fn(async () => {
      if (queue.length === 0) return { value: undefined, done: true };
      const next = queue.shift()!;
      if (next instanceof Error) throw next;
      return { value: next, done: false };
    }),
    cancel: jest.fn(async () => {}),
    releaseLock: jest.fn(),
  };
}

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function mockStream(
  chunks: (Uint8Array | Error)[],
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): ReaderStub {
  const reader = makeReader(chunks);
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    body: ok ? { getReader: () => reader } : null,
  });
  return reader;
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("streamSSE", () => {
  it("parses a single LF-terminated event", async () => {
    mockStream([encode('event: artist\ndata: {"id":"x"}\n\n')]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([{ event: "artist", data: '{"id":"x"}' }]);
  });

  it("parses multiple events from a single chunk", async () => {
    mockStream([
      encode("event: a\ndata: 1\n\nevent: b\ndata: 2\n\nevent: c\ndata: 3\n\n"),
    ]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([
      { event: "a", data: "1" },
      { event: "b", data: "2" },
      { event: "c", data: "3" },
    ]);
  });

  it("buffers events split across multiple read chunks", async () => {
    mockStream([
      encode('event: artist\ndata: {"par'),
      encode('t":1}\n\nevent: complete\nda'),
      encode("ta: {}\n\n"),
    ]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([
      { event: "artist", data: '{"part":1}' },
      { event: "complete", data: "{}" },
    ]);
  });

  it("normalizes CRLF line endings", async () => {
    mockStream([encode("event: artist\r\ndata: hi\r\n\r\n")]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([{ event: "artist", data: "hi" }]);
  });

  it("normalizes bare CR line endings", async () => {
    mockStream([encode("event: artist\rdata: hi\r\r")]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([{ event: "artist", data: "hi" }]);
  });

  it("defaults event name to 'message' when only data is present", async () => {
    mockStream([encode("data: hello\n\n")]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([{ event: "message", data: "hello" }]);
  });

  it("joins multi-line data with newlines", async () => {
    mockStream([encode("data: line1\ndata: line2\ndata: line3\n\n")]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([{ event: "message", data: "line1\nline2\nline3" }]);
  });

  it("skips frames that contain no data lines", async () => {
    mockStream([encode("event: keepalive\n\nevent: artist\ndata: x\n\n")]);

    const events = await collect(streamSSE("http://example/stream"));
    expect(events).toEqual([{ event: "artist", data: "x" }]);
  });

  it("throws with no URL in the message when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null });

    await expect(async () => {
      for await (const _ of streamSSE("http://example/stream?token=secret")) {
        void _;
      }
    }).rejects.toThrow("SSE request failed: 500");

    try {
      for await (const _ of streamSSE("http://example/stream?token=secret")) {
        void _;
      }
    } catch (err) {
      expect((err as Error).message).not.toContain("token=secret");
      expect((err as Error).message).not.toContain("http://example");
    }
  });

  it("forwards custom headers alongside the default Accept header", async () => {
    mockStream([encode("event: artist\ndata: {}\n\n")]);

    await collect(
      streamSSE("http://example/stream", {
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://example/stream",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("stops iterating when the signal aborts mid-stream", async () => {
    const controller = new AbortController();
    const reader = mockStream([
      encode("event: artist\ndata: 1\n\n"),
      encode("event: artist\ndata: 2\n\n"),
      encode("event: artist\ndata: 3\n\n"),
    ]);

    const gen = streamSSE("http://example/stream", {
      signal: controller.signal,
    });

    const collected: unknown[] = [];
    for await (const evt of gen) {
      collected.push(evt);
      if (collected.length === 1) controller.abort();
    }

    expect(collected).toHaveLength(1);
    expect(reader.cancel).toHaveBeenCalled();
  });

  it("cancels the reader on normal stream completion", async () => {
    const reader = mockStream([encode("event: artist\ndata: 1\n\n")]);

    await collect(streamSSE("http://example/stream"));

    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  it("cancels the reader when the consumer throws", async () => {
    const reader = mockStream([
      encode("event: artist\ndata: 1\n\n"),
      encode("event: artist\ndata: 2\n\n"),
    ]);

    const gen = streamSSE("http://example/stream");
    await expect(
      (async () => {
        for await (const _ of gen) {
          void _;
          throw new Error("consumer error");
        }
      })(),
    ).rejects.toThrow("consumer error");

    expect(reader.cancel).toHaveBeenCalled();
  });

  it("tolerates reader.cancel rejecting", async () => {
    const reader = mockStream([encode("event: artist\ndata: 1\n\n")]);
    reader.cancel.mockRejectedValueOnce(new Error("already closed"));

    await expect(collect(streamSSE("http://example/stream"))).resolves.toEqual([
      { event: "artist", data: "1" },
    ]);
  });
});
