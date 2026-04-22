import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArtistDetailLayout } from "@/components/artist/ArtistDetailLayout";
import { useLibraryArtist } from "@/hooks/library/use-library-artist";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import type { PrimaryReleaseType } from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";

export function BrowseArtistDetailScreen() {
  const { mbid, name } = useLocalSearchParams<{ mbid: string; name: string }>();
  const router = useRouter();

  const { isInLibrary } = useLibraryLookup();
  const inLibrary = isInLibrary(mbid!);
  const { data: libraryArtist } = useLibraryArtist(
    inLibrary ? mbid : undefined,
  );

  const navigateToReleases = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      router.push({
        pathname: "/artist/releases",
        params: {
          artistMbid: mbid!,
          albumType: type,
          title: label,
          artistName: name!,
        },
      });
    },
    [router, mbid, name],
  );

  const navigateToAlbums = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      if (!libraryArtist) return;
      router.push({
        pathname: "/artist/albums",
        params: {
          artistId: libraryArtist.id,
          artistMbid: libraryArtist.mbid,
          albumType: type,
          title: label,
          artistName: libraryArtist.artistName,
        },
      });
    },
    [router, libraryArtist],
  );

  const handleSimilarPress = useCallback(
    (artist: SimilarArtist) => {
      router.push({
        pathname: "/artist/[mbid]",
        params: { mbid: artist.id, name: artist.name },
      });
    },
    [router],
  );

  return (
    <ArtistDetailLayout
      mbid={mbid!}
      artistName={name!}
      onNavigateToReleases={navigateToReleases}
      onNavigateToAlbums={libraryArtist ? navigateToAlbums : undefined}
      onSimilarArtistPress={handleSimilarPress}
    />
  );
}
