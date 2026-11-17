import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { MediaRow } from "@/components/ui/MediaRow";
import { albumTrackArtist } from "@/hooks/library/album-track-context";
import type { AlbumTrack } from "@/lib/types/library";

/** A track in a list of many albums: its album's cover, artist and album. */
export function SongRow({
  track,
  onPress,
  onOpenActions,
}: {
  track: AlbumTrack;
  onPress: () => void;
  onOpenActions: () => void;
}) {
  return (
    <MediaRow
      imageType="album"
      mbid={track.album?.mbid}
      coverUrl={track.album?.coverUrl}
      title={track.trackName}
      subtitle={[albumTrackArtist(track), track.album?.albumName]
        .filter(Boolean)
        .join(" · ")}
      showChevron={false}
      trailing={
        <TrackMenuButton trackName={track.trackName} onPress={onOpenActions} />
      }
      onPress={onPress}
      onLongPress={onOpenActions}
    />
  );
}
