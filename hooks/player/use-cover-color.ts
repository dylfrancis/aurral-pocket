import { useQuery } from "@tanstack/react-query";
import { getColors } from "react-native-image-colors";
import { imageSource, serverImageSource } from "@/lib/api/client";
import { pickCoverColor } from "@/lib/player/artwork-tint";
import type { PlayerTrack } from "@/lib/player/track-item";
import { playerKeys } from "@/lib/query-keys";

type ImageSource = { uri: string; headers?: Record<string, string> };

/** Null while the cover loads, or when the track has none. */
export function useCoverColor(
  track: Pick<PlayerTrack, "artwork" | "coverPath"> | null,
): string | null {
  // The same order PlayerArtwork loads in: the server's cover, then the URL.
  const sources = [
    serverImageSource(track?.coverPath),
    track?.artwork ? imageSource(track.artwork) : null,
  ].filter((source): source is ImageSource => source !== null);
  const key = sources[0]?.uri ?? null;

  const { data } = useQuery({
    queryKey: playerKeys.coverColor(key ?? ""),
    queryFn: () => loadCoverColor(sources),
    enabled: key !== null,
    // A cover's colors never change.
    staleTime: Infinity,
    retry: false,
  });
  return key === null ? null : (data ?? null);
}

async function loadCoverColor(sources: ImageSource[]): Promise<string | null> {
  for (const source of sources) {
    try {
      const colors = await getColors(source.uri, {
        headers: source.headers,
        quality: "low",
      });
      return pickCoverColor(colors);
    } catch {
      // Try the next source.
    }
  }
  return null;
}
