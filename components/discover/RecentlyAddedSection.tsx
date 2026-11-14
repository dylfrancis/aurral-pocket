import { StyleSheet } from "react-native";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useRecentlyAdded } from "@/hooks/discover";
import { useLibraryLookup } from "@/hooks/search/use-library-lookup";
import { formatDate } from "@/lib/date-time";
import { recentlyAddedMbid } from "@/lib/discover/format";
import type { RecentlyAddedArtist } from "@/lib/types/search";
import { DiscoverRail } from "./DiscoverRail";
import {
  ARTIST_CARD_WIDTH,
  HorizontalArtistCard,
} from "./HorizontalArtistCard";

type Props = {
  onArtistPress: (artist: RecentlyAddedArtist) => void;
  onViewAll?: () => void;
};

function formatAdded(date?: string | null) {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return `Added ${formatDate(d)}`;
}

export function RecentlyAddedSection({ onArtistPress, onViewAll }: Props) {
  // Repaint the "Added" dates when the server format changes.
  useDateTimeFormat();
  const { data, isLoading } = useRecentlyAdded();
  const artists = data ?? [];
  const { isInLibrary } = useLibraryLookup(artists.map(recentlyAddedMbid));

  return (
    <DiscoverRail
      title="Recently Added"
      items={artists}
      keyOf={(artist) => artist.id}
      renderItem={(artist) => {
        const mbid = recentlyAddedMbid(artist);
        return (
          <HorizontalArtistCard
            mbid={mbid}
            name={artist.artistName}
            subtitle={formatAdded(artist.addedAt || artist.added)}
            isInLibrary={isInLibrary(mbid)}
            onPress={() => onArtistPress(artist)}
          />
        );
      }}
      cardSize={ARTIST_CARD_WIDTH}
      isLoading={isLoading}
      onViewAll={onViewAll}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
});
