import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArtistDetailLayout } from "@/components/artist/ArtistDetailLayout";
import { useLibraryArtist } from "@/hooks/library/use-library-artist";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { EmptyState } from "@/components/library/EmptyState";
import type { PrimaryReleaseType } from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";

export default function LibraryArtistDetailScreen() {
  const { mbid } = useLocalSearchParams<{ mbid: string }>();
  const router = useRouter();

  const { data: artist, isLoading, error, refetch } = useLibraryArtist(mbid);

  const navigateToReleases = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      router.push({
        pathname: "/artist/releases",
        params: {
          artistId: artist?.id,
          artistMbid: mbid!,
          albumType: type,
          title: label,
          artistName: artist?.artistName ?? "",
        },
      });
    },
    [router, artist, mbid],
  );

  const navigateToAlbums = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      if (!artist) return;
      router.push({
        pathname: "/artist/albums",
        params: {
          artistId: artist.id,
          artistMbid: artist.mbid,
          albumType: type,
          title: label,
          artistName: artist.artistName,
        },
      });
    },
    [router, artist],
  );

  const handleSimilarPress = useCallback(
    (similar: SimilarArtist) => {
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: similar.id, name: similar.name },
      });
    },
    [router],
  );

  if (isLoading) return <ScreenCenter loading />;

  if (error) {
    return (
      <ScreenCenter>
        <EmptyState
          icon="cloud-offline-outline"
          message="Failed to load artist"
          actionLabel="Try Again"
          onAction={() => refetch()}
        />
      </ScreenCenter>
    );
  }

  if (!artist) {
    return (
      <ScreenCenter>
        <EmptyState icon="alert-circle-outline" message="Artist not found" />
      </ScreenCenter>
    );
  }

  return (
    <ArtistDetailLayout
      mbid={artist.mbid}
      artistName={artist.artistName}
      onNavigateToReleases={navigateToReleases}
      onNavigateToAlbums={navigateToAlbums}
      onSimilarArtistPress={handleSimilarPress}
    />
  );
}
