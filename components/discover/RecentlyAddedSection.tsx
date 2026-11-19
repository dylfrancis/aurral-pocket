import { StyleSheet } from "react-native";
import { useDateTimeFormat } from "@/hooks/use-date-time-format";
import { useRecentlyAdded } from "@/hooks/discover";
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

  return (
    <DiscoverRail
      title="Recently Added"
      items={artists}
      keyOf={(artist) => artist.id}
      // Every artist here is in the Library, so the cards carry no mark.
      renderItem={(artist) => (
        <HorizontalArtistCard
          mbid={recentlyAddedMbid(artist)}
          name={artist.artistName}
          subtitle={formatAdded(artist.addedAt || artist.added)}
          onPress={() => onArtistPress(artist)}
        />
      )}
      cardSize={ARTIST_CARD_WIDTH}
      cardShape="circle"
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
