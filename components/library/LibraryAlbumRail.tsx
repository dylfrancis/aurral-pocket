import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useItemActions } from "@/components/actions/item-actions-context";
import { libraryAlbumTarget } from "@/components/actions/targets";
import { DiscoverRail } from "@/components/discover/DiscoverRail";
import { ALBUM_CARD_WIDTH, AlbumCard } from "@/components/library/AlbumCard";
import { useAlbumRail } from "@/hooks/library/use-album-rail";
import { albumRouteParams } from "@/lib/library-read";
import type { LibraryAlbumSortMode } from "@/components/library/AlbumSortPicker";
import type { LibrarySort } from "@/lib/types/library";

type LibraryAlbumRailProps = {
  title: string;
  sort: LibrarySort & LibraryAlbumSortMode;
  availableOnly?: boolean;
  /** False for a rail with no View All, such as Explore. */
  showAll?: boolean;
  /** Changes on each return to the tab, to reread a rail that moves. */
  refreshKey?: number;
};

/** Its › opens Albums on the same sort; hidden once loaded with nothing. */
export function LibraryAlbumRail({
  title,
  sort,
  availableOnly,
  showAll = true,
  refreshKey,
}: LibraryAlbumRailProps) {
  const router = useRouter();
  const { openAlbum } = useItemActions();
  const { data, isPending, isError, refetch } = useAlbumRail(
    sort,
    availableOnly,
  );

  useEffect(() => {
    if (refreshKey) void refetch();
  }, [refreshKey, refetch]);

  if (isError) return null;

  return (
    <DiscoverRail
      title={title}
      items={data ?? []}
      keyOf={(album) => album.id}
      // A bare path, so expo-router resolves it inside the Library tab.
      renderItem={(album) => (
        <AlbumCard
          album={album}
          showArtist
          onLongPress={() => openAlbum(libraryAlbumTarget(album))}
          onPress={() =>
            router.push({
              pathname: "/album/[ref]",
              params: albumRouteParams(album, undefined, album.artistMbid),
            })
          }
        />
      )}
      cardSize={ALBUM_CARD_WIDTH}
      isLoading={isPending}
      onViewAll={
        showAll
          ? () => router.push({ pathname: "/albums", params: { sort } })
          : undefined
      }
    />
  );
}
