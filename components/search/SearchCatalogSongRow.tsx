import { ActivityIndicator } from "react-native";
import { TrackMenuButton } from "@/components/library/TrackMenuButton";
import { MediaRow } from "@/components/ui/MediaRow";
import { PreviewTag } from "@/components/ui/PreviewTag";
import { useAudioPreview } from "@/hooks/library/use-audio-preview";
import { useColors } from "@/hooks/use-colors";
import { catalogSongClipId, catalogSongClipPath } from "@/lib/search-results";
import type { CatalogSong } from "@/lib/types/search";

/**
 * A catalog song the Library doesn't have; a tap plays or pauses its clip. It
 * follows the player itself, as an album's clip rows do.
 */
export function SearchCatalogSongRow({
  song,
  onOpenActions,
}: {
  song: CatalogSong;
  onOpenActions: () => void;
}) {
  const colors = useColors();
  const { playingId, loadingId, toggle } = useAudioPreview();
  const id = catalogSongClipId(song);
  const loading = loadingId === id;

  return (
    <MediaRow
      imageType="album"
      mbid={song.albumMbid}
      coverUrl={song.coverUrl ?? undefined}
      title={song.title}
      titleAccessory={<PreviewTag />}
      active={playingId === id || loading}
      subtitle={[song.artistName, song.albumTitle].filter(Boolean).join(" · ")}
      showChevron={false}
      trailing={
        <>
          {loading ? (
            <ActivityIndicator size="small" color={colors.subtle} />
          ) : null}
          <TrackMenuButton trackName={song.title} onPress={onOpenActions} />
        </>
      }
      onPress={() =>
        void toggle(id, catalogSongClipPath(song), {
          title: song.title,
          artist: song.artistName,
          album: song.albumTitle ?? undefined,
          artwork: song.coverUrl,
        })
      }
      onLongPress={onOpenActions}
    />
  );
}
