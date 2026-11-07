import { AlbumCategorySkeleton } from "@/components/artist/AlbumCategorySkeleton";
import { useEditorialShelf } from "@/hooks/discover/use-editorial-playlists";
import { EditorialPlaylistRail } from "./EditorialPlaylistRail";

type Props = {
  onViewAll: () => void;
};

/** As on the web, someone with no taste data yet gets the first genre's row. */
export function EditorialPlaylistsSection({ onViewAll }: Props) {
  const { data, isLoading } = useEditorialShelf();

  if (isLoading) return <AlbumCategorySkeleton />;

  const forYou = data?.forYou ?? [];
  const playlists =
    forYou.length > 0 ? forYou : (data?.genres[0]?.playlists ?? []);

  if (playlists.length === 0) return null;

  return (
    <EditorialPlaylistRail
      title="Playlists"
      playlists={playlists}
      onViewAll={onViewAll}
    />
  );
}
