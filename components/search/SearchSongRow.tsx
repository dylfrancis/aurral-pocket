import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { MediaRow } from "@/components/ui/MediaRow";
import type { LibrarySearchTrack } from "@/lib/types/search";

/** A Library song. ⋯ and a long press both open its actions. */
export function SearchSongRow({
  track,
  onPress,
  onOpenActions,
}: {
  track: LibrarySearchTrack;
  onPress: () => void;
  onOpenActions: () => void;
}) {
  return (
    <MediaRow
      imageType="album"
      mbid={track.albumMbid}
      coverUrl={track.coverUrl ?? undefined}
      title={track.title}
      subtitle={[track.artistName, track.albumTitle]
        .filter(Boolean)
        .join(" · ")}
      showChevron={false}
      trailing={
        <TrackMenuButton trackName={track.title} onPress={onOpenActions} />
      }
      onPress={onPress}
      onLongPress={onOpenActions}
    />
  );
}
