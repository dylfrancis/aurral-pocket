import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArtistDetailLayout } from "@/components/artist/ArtistDetailLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import { useLibraryArtist } from "@/hooks/library/use-library-artist";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { isValidMbid } from "@/lib/blocklist";
import type { PrimaryReleaseType } from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";

/**
 * The artist page in every tab, for artists in the library and out of it. It
 * shows at once, and the library parts fill in once the lookup answers.
 */
export function BrowseArtistDetailScreen() {
  const { mbid } = useLocalSearchParams<{ mbid: string }>();

  // An artist scanned without a MusicBrainz id links here with its library
  // id, and every read behind this page needs an MBID.
  if (!isValidMbid(mbid)) {
    return (
      <ScreenCenter>
        <EmptyState icon="alert-circle-outline" message="Artist not found" />
      </ScreenCenter>
    );
  }

  return <ArtistPage />;
}

function ArtistPage() {
  const { mbid, name, coverUrl } = useLocalSearchParams<{
    mbid: string;
    name?: string;
    coverUrl?: string;
  }>();
  const router = useRouter();

  const { isInLibrary } = useLibraryLookup([mbid]);
  const inLibrary = isInLibrary(mbid!);
  const { data: libraryArtist } = useLibraryArtist(
    inLibrary ? mbid : undefined,
  );
  // The library's own name beats the link's, which can be a search or a credit.
  const artistName = libraryArtist?.artistName || name || "";

  const navigateToReleases = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      router.push({
        pathname: "/artist/releases",
        params: {
          // Spares the release page a lookup of the artist's id.
          artistId: libraryArtist?.id ?? "",
          artistMbid: mbid!,
          albumType: type,
          title: label,
          artistName,
        },
      });
    },
    [router, mbid, artistName, libraryArtist?.id],
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
      artistName={artistName}
      coverUrl={coverUrl}
      onNavigateToReleases={navigateToReleases}
      onNavigateToAlbums={libraryArtist ? navigateToAlbums : undefined}
      onSimilarArtistPress={handleSimilarPress}
    />
  );
}
