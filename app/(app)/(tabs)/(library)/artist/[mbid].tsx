import { useCallback } from "react";
import {
  useLocalSearchParams,
  useRouter,
  type ErrorBoundaryProps,
} from "expo-router";
import { ArtistDetailLayout } from "@/components/artist/ArtistDetailLayout";
import { useLibraryArtistSuspense } from "@/hooks/library/use-library-artist";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import type { PrimaryReleaseType } from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";

export default function LibraryArtistDetailScreen() {
  const { mbid } = useLocalSearchParams<{ mbid: string }>();
  const router = useRouter();

  const { data: artist } = useLibraryArtistSuspense(mbid);

  const navigateToReleases = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      router.push({
        pathname: "/artist/releases",
        params: {
          artistId: artist.id,
          artistMbid: mbid,
          albumType: type,
          title: label,
          artistName: artist.artistName,
        },
      });
    },
    [router, artist, mbid],
  );

  const navigateToAlbums = useCallback(
    (type: PrimaryReleaseType, label: string) => {
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

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <RouteErrorBoundary
      {...props}
      message="Failed to load artist"
      notFoundMessage="Artist not found"
    />
  );
}
