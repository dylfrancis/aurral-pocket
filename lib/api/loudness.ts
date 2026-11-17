import { fetch } from "expo/fetch";
import { buildAuthenticatedUrl, customHeadersFor } from "@/lib/api/client";

/**
 * Integrated loudness in LUFS from a HEAD of the stream: null when Aurral has
 * none, rejects when the request fails. A first ask waits while Aurral reads
 * the whole file.
 */
export async function getStreamLoudness(
  streamPath: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const url = streamPath.startsWith("/")
    ? buildAuthenticatedUrl(streamPath)
    : null;
  if (!url) throw new Error("No stream URL");
  const response = await fetch(url, {
    method: "HEAD",
    headers: customHeadersFor(url),
    // A saved playlist track redirects to a Deezer clip, which mustn't get
    // the proxy headers.
    redirect: "error",
    signal,
  });
  // A missing file has nothing to measure.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const lufs = Number.parseFloat(
    response.headers.get("x-aurral-loudness") ?? "",
  );
  return Number.isFinite(lufs) ? lufs : null;
}
