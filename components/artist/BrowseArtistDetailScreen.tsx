import { useCallback } from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArtistDetailLayout } from "@/components/artist/ArtistDetailLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { ScreenCenter } from "@/components/ui/ScreenCenter";
import {
  useCanonicalArtist,
  useLibraryArtist,
} from "@/hooks/library/use-library-artist";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { isValidMbid } from "@/lib/blocklist";
import { isLibraryArtistId } from "@/lib/library-read";
import type { PrimaryReleaseType } from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";
import { useOpenArtist } from "@/hooks/use-open-artist";
import { useColors } from "@/hooks/use-colors";

function matchedMbid(mbid: string | null | undefined) {
  return mbid && isValidMbid(mbid) ? mbid : undefined;
}

function ArtistNotFound() {
  return (
    <ScreenCenter>
      <EmptyState icon="alert-circle-outline" message="Artist not found" />
    </ScreenCenter>
  );
}

/**
 * The artist page in every tab, for artists in the Library and out of it. An
 * artist with no MBID opens by its Library id and shows only what the Library
 * holds.
 */
export function BrowseArtistDetailScreen() {
  const { mbid: artistRef } = useLocalSearchParams<{ mbid: string }>();

  if (!isValidMbid(artistRef) && !isLibraryArtistId(artistRef)) {
    return <ArtistNotFound />;
  }

  return <ArtistPage artistRef={artistRef!} />;
}

function ArtistPage({ artistRef }: { artistRef: string }) {
  const { name, coverUrl } = useLocalSearchParams<{
    name?: string;
    coverUrl?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const openArtist = useOpenArtist();

  const libraryRef = isLibraryArtistId(artistRef) ? artistRef : undefined;
  const { data: canonicalArtist, isPending: rowPending } =
    useCanonicalArtist(libraryRef);
  // A link by Library id to an artist Aurral has matched since opens the full
  // page.
  const mbid = isValidMbid(artistRef)
    ? artistRef
    : matchedMbid(canonicalArtist?.mbid);
  const { isInLibrary } = useLibraryLookup([mbid]);
  const inLibrary = mbid ? isInLibrary(mbid) : true;
  const { data: libraryArtist } = useLibraryArtist(
    inLibrary ? mbid : undefined,
  );
  const artist = mbid ? libraryArtist : canonicalArtist;
  // The library's own name beats the link's, which can be a search or a credit.
  const artistName = artist?.artistName || name || "";

  const navigateToReleases = useCallback(
    (type: PrimaryReleaseType, label: string) => {
      router.push({
        pathname: "/artist/releases",
        params: {
          // Spares the release page a lookup of the artist's id.
          artistId: libraryArtist?.id ?? "",
          artistMbid: mbid ?? "",
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
    (similar: SimilarArtist) =>
      openArtist({ mbid: similar.id, name: similar.name }),
    [openArtist],
  );

  if (libraryRef) {
    // The row says which page to show. A failed read shows the Library one.
    if (rowPending) {
      return (
        <ScreenCenter>
          <ActivityIndicator color={colors.subtle} />
        </ScreenCenter>
      );
    }
    if (canonicalArtist === null) return <ArtistNotFound />;
  }

  return (
    <ArtistDetailLayout
      // Remounts when the artist turns out to be matched.
      key={mbid ?? artistRef}
      artistRef={mbid ?? artistRef}
      artistName={artistName}
      coverUrl={coverUrl}
      onNavigateToReleases={navigateToReleases}
      onNavigateToAlbums={artist ? navigateToAlbums : undefined}
      onSimilarArtistPress={handleSimilarPress}
    />
  );
}
