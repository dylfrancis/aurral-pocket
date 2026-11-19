import {
  useOpenEditorialPlaylist,
  usePlayEditorialPlaylist,
} from "@/hooks/discover/use-editorial-playlists";
import { formatTrackCount } from "@/lib/discover/format";
import type { EditorialPlaylistSummary } from "@/lib/types/search";
import { EditorialCard } from "./EditorialCard";
import { EDITORIAL_CARD_SIZE, EditorialRail } from "./EditorialRail";
import { ViewAllCard } from "./ViewAllCard";

type Props = {
  title: string;
  playlists: EditorialPlaylistSummary[];
  onViewAll?: () => void;
  withPlayButtons?: boolean;
};

export function EditorialPlaylistRail({
  title,
  playlists,
  onViewAll,
  withPlayButtons = false,
}: Props) {
  const openPlaylist = useOpenEditorialPlaylist();
  const { play, loadingId } = usePlayEditorialPlaylist();

  return (
    <EditorialRail title={title} onNavigate={onViewAll}>
      {playlists.map((playlist) => {
        const key = `${playlist.provider}:${playlist.id}`;
        return (
          <EditorialCard
            key={key}
            name={playlist.name}
            caption={formatTrackCount(playlist.trackCount)}
            artworkUrl={playlist.artworkUrl}
            size={EDITORIAL_CARD_SIZE}
            onPress={() => openPlaylist(playlist)}
            onPlay={withPlayButtons ? () => void play(playlist) : undefined}
            playLoading={loadingId === key}
          />
        );
      })}
      {onViewAll ? (
        <ViewAllCard size={EDITORIAL_CARD_SIZE} onPress={onViewAll} />
      ) : null}
    </EditorialRail>
  );
}
