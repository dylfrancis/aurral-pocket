import { Chip } from "@/components/ui/Chip";
import { useHasPermission } from "@/hooks/auth/use-has-permission";
import { useAddEditorialPlaylist } from "@/hooks/discover/use-editorial-playlists";
import { useOpenPlaylist } from "@/hooks/flow/use-open-playlist";
import type { TrendingSongsChart } from "@/lib/types/search";

type Props = {
  songs: TrendingSongsChart;
  onLeave: () => void;
};

export function SaveChartButton({ songs, onLeave }: Props) {
  const hasFlowAccess = useHasPermission()("accessFlow");
  const save = useAddEditorialPlaylist(songs.playlistId);
  const openPlaylist = useOpenPlaylist();

  if (!hasFlowAccess) return null;

  const { libraryPlaylistId } = songs;
  if (libraryPlaylistId) {
    return (
      <Chip
        label="Open in Library"
        icon="checkmark-circle"
        variant="brand"
        size="md"
        onPress={() => {
          onLeave();
          void openPlaylist(libraryPlaylistId);
        }}
      />
    );
  }

  return (
    <Chip
      label="Save as Playlist"
      icon="add"
      variant="brand"
      size="md"
      loading={save.isPending}
      onPress={() => save.mutate()}
    />
  );
}
