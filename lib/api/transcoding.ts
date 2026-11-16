import { fetch } from "expo/fetch";
import {
  buildAuthenticatedUrl,
  customHeadersFor,
  getServerUrl,
} from "@/lib/api/client";
import { getServerHealth } from "@/lib/api/health";
import {
  TRANSCODE_OUTPUT,
  type TranscodeRequest,
} from "@/lib/player/transcoding";
import { queryClient } from "@/lib/query-client";
import { authKeys } from "@/lib/query-keys";

// These are the routes covered by the streamTranscoding app capability.
const STREAM_PATH =
  /^\/(?:library\/(?:file-)?stream\/[^/?#]+\/[^/?#]+|playlists\/stream\/[^/?#]+)$/;

export async function fetchTranscodedAudio(
  streamPath: string,
  { format, kbps }: TranscodeRequest,
  signal: AbortSignal,
) {
  if (signal.aborted || !STREAM_PATH.test(streamPath)) return null;
  const params = { format, maxBitRate: kbps };
  const stream = buildAuthenticatedUrl(streamPath, params);
  if (!stream) return null;
  const isCurrent = () =>
    !signal.aborted && stream === buildAuthenticatedUrl(streamPath, params);

  const health = await queryClient.fetchQuery({
    queryKey: authKeys.health(getServerUrl()),
    queryFn: getServerHealth,
    staleTime: 60_000,
    retry: false,
  });
  // An older server silently ignores transcoding parameters.
  if (!isCurrent() || !health.api?.features.includes("streamTranscoding")) {
    return null;
  }

  const audio = await fetch(stream, {
    headers: customHeadersFor(stream),
    redirect: "error",
    signal,
  });
  const contentType = audio.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (
    !isCurrent() ||
    !audio.ok ||
    !TRANSCODE_OUTPUT[format].mime.some((type) => type === contentType)
  ) {
    await audio.body?.cancel();
    return null;
  }
  return audio.body;
}
