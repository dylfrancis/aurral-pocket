import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { libraryTracksRef } from "@/lib/library-read";
import {
  useIsSaved,
  useIsTrackSaved,
  type SavedKind,
} from "@/lib/offline/saved-library";

/**
 * The ↓ beside an album or playlist once it's all on the phone. `inline` is
 * for a mark inside a line of text, which needs a space after it.
 */
export function SavedMark({
  kind,
  id,
  size = 14,
  inline = false,
}: {
  kind: SavedKind;
  id: string | null | undefined;
  size?: number;
  inline?: boolean;
}) {
  const saved = useIsSaved(kind, id);
  if (!saved) return null;
  const mark = <SavedIcon size={size} />;
  return inline ? <>{mark} </> : mark;
}

/** The ↓ on a track row once the track is on the phone, by whatever save. */
export function SavedTrackMark({ trackId }: { trackId: string }) {
  const saved = useIsTrackSaved(trackId);
  return saved ? <SavedIcon size={16} /> : null;
}

function SavedIcon({ size }: { size: number }) {
  const colors = Colors[useColorScheme()];
  return (
    <Ionicons
      name="arrow-down-circle"
      size={size}
      color={colors.brand}
      accessibilityLabel="Saved offline"
    />
  );
}

/** An album is saved under its page's `ref`, which a list row can rebuild. */
export function albumSavedId(album: {
  id: string;
  mbid?: string;
  canonicalId?: string;
}): string | undefined {
  return libraryTracksRef({
    albumId: album.id,
    albumMbid: album.mbid,
    canonicalAlbumId: album.canonicalId,
  });
}
