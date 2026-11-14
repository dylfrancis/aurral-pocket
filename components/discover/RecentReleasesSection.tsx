import { StyleSheet } from "react-native";
import { useRecentReleases } from "@/hooks/discover";
import type { RecentReleaseAlbum } from "@/lib/types/search";
import { DiscoverReleaseCard, RELEASE_CARD_WIDTH } from "./DiscoverReleaseCard";
import { DiscoverRail } from "./DiscoverRail";

type Props = {
  onAlbumPress: (album: RecentReleaseAlbum) => void;
  onViewAll?: () => void;
};

export function RecentReleasesSection({ onAlbumPress, onViewAll }: Props) {
  const { data, isLoading } = useRecentReleases();

  return (
    <DiscoverRail
      title="Recent & Upcoming Releases"
      items={data ?? []}
      keyOf={(album, index) =>
        album.id ||
        album.mbid ||
        album.foreignAlbumId ||
        `${album.albumName}-${index}`
      }
      renderItem={(album) => (
        <DiscoverReleaseCard
          album={album}
          onPress={() => onAlbumPress(album)}
        />
      )}
      cardSize={RELEASE_CARD_WIDTH}
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
