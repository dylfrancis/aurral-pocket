import { useItemActions } from "@/components/actions/item-actions-context";
import { recentReleaseTarget } from "@/components/actions/targets";
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
  const { openAlbum } = useItemActions();

  return (
    <DiscoverRail
      title="Recent & Upcoming Releases"
      items={data ?? []}
      keyOf={(album) => album.releaseGroupMbid}
      renderItem={(album) => (
        <DiscoverReleaseCard
          album={album}
          onPress={() => onAlbumPress(album)}
          onLongPress={() => openAlbum(recentReleaseTarget(album))}
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
