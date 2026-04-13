import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArtistDetailLayout } from "@/components/artist/ArtistDetailLayout";
import type { PrimaryReleaseType } from "@/lib/types/library";
import type { SimilarArtist } from "@/lib/types/search";

export default function SearchArtistDetailScreen() {
  const { mbid, name } = useLocalSearchParams<{ mbid: string; name: string }>();
  const router = useRouter();

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
      onSimilarArtistPress={handleSimilarPress}
    />
  );
}
