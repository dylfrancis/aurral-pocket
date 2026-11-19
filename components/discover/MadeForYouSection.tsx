import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { useMadeForYou } from "@/hooks/discover/use-editorial-playlists";
import { EditorialPlaylistRail } from "./EditorialPlaylistRail";

type Props = {
  onViewAll?: () => void;
};

export function MadeForYouSection({ onViewAll }: Props) {
  const { data, isLoading } = useMadeForYou();

  if (isLoading) return <AlbumCategorySkeleton />;
  if (!data || data.length === 0) return null;

  return (
    <EditorialPlaylistRail
      title="Made for You"
      playlists={data}
      onViewAll={onViewAll}
      withPlayButtons
    />
  );
}
