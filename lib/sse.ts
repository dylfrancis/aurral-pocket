import { fetch } from "expo/fetch";

export type SSEEvent = { event: string; data: string };

type StreamInit = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Consume a server-sent-events stream from a URL using expo/fetch's streaming
 * response body. Yields each parsed event as the wire emits it. Respects the
 * supplied AbortSignal so unmounted consumers can tear the stream down.
 */
export async function* streamSSE(
  url: string,
  { signal, headers }: StreamInit = {},
): AsyncGenerator<SSEEvent> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "text/event-stream", ...(headers ?? {}) },
  });
  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");

      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event = "message";
        const dataLines: string[] = [];
        for (const raw of chunk.split("\n")) {
          if (raw.startsWith("event:")) event = raw.slice(6).trim();
          else if (raw.startsWith("data:")) dataLines.push(raw.slice(5).trim());
        }
        if (dataLines.length > 0) {
          yield { event, data: dataLines.join("\n") };
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // reader may already be closed; ignore
    }
    reader.releaseLock();
  }
}
