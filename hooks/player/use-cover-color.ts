import { useQuery } from "@tanstack/react-query";
import { getColors } from "react-native-image-colors";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { imageSource, serverImageSource } from "@/lib/api/client";
import { pickCoverColor, tintForScheme } from "@/lib/player/artwork-tint";
import { playerKeys } from "@/lib/query-keys";

type ImageSource = { uri: string; headers?: Record<string, string> };

/** Where a cover loads from: the server's path first, then the URL. */
export type CoverSources = {
  coverPath?: string | null;
  artwork?: string | null;
};

/** Null while the cover loads, or when there is none. */
export function useCoverColor(cover: CoverSources | null): string | null {
  // The same order the artwork loads in: the server's cover, then the URL.
  const sources = [
    serverImageSource(cover?.coverPath),
    cover?.artwork ? imageSource(cover.artwork) : null,
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

/**
 * The cover's color, shifted so the scheme's text reads on it. The scheme's
 * background stands in while the cover loads, or when there is none.
 */
export function useCoverTint(cover: CoverSources | null): string {
  const scheme = useColorScheme();
  const color = useCoverColor(cover);
  return color ? tintForScheme(color, scheme) : Colors[scheme].background;
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
