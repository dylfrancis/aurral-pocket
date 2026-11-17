import { useOpenEditorialPlaylist } from "@/hooks/discover/use-editorial-playlists";
import { formatTrackCount } from "@/lib/discover/format";
import type { EditorialPlaylistSummary } from "@/lib/types/search";
import { EditorialCard } from "./EditorialCard";
import { EDITORIAL_CARD_SIZE, EditorialRail } from "./EditorialRail";
import { ViewAllCard } from "./ViewAllCard";

type Props = {
  title: string;
  playlists: EditorialPlaylistSummary[];
  onViewAll?: () => void;
};

export function EditorialPlaylistRail({ title, playlists, onViewAll }: Props) {
  const openPlaylist = useOpenEditorialPlaylist();

  return (
    <EditorialRail title={title} onNavigate={onViewAll}>
      {playlists.map((playlist) => (
        <EditorialCard
          key={`${playlist.provider}:${playlist.id}`}
          name={playlist.name}
          caption={formatTrackCount(playlist.trackCount)}
          artworkUrl={playlist.artworkUrl}
          size={EDITORIAL_CARD_SIZE}
          onPress={() => openPlaylist(playlist)}
        />
      ))}
      {onViewAll ? (
        <ViewAllCard size={EDITORIAL_CARD_SIZE} onPress={onViewAll} />
      ) : null}
    </EditorialRail>
  );
}
