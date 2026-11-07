import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useOpenEditorialPlaylist } from "@/hooks/discover/use-editorial-playlists";
import { formatTrackCount } from "@/lib/discover/format";
import type { EditorialPlaylistSummary } from "@/lib/types/search";
import { EditorialArtwork } from "./EditorialArtwork";
import { ViewAllCard } from "./ViewAllCard";

const CARD_SIZE = 150;

type Props = {
  title: string;
  playlists: EditorialPlaylistSummary[];
  onViewAll?: () => void;
};

export function EditorialPlaylistRail({ title, playlists, onViewAll }: Props) {
  const openPlaylist = useOpenEditorialPlaylist();

  return (
    <View style={styles.container}>
      <SectionHeader title={title} onNavigate={onViewAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${playlist.name}`}
            onPress={() => openPlaylist(playlist)}
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <EditorialArtwork
              name={playlist.name}
              uri={playlist.artworkUrl}
              size={CARD_SIZE}
              radius={10}
            />
            <View style={styles.info}>
              <Text variant="body" numberOfLines={1} style={styles.title}>
                {playlist.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {formatTrackCount(playlist.trackCount)}
              </Text>
            </View>
          </Pressable>
        ))}
        {onViewAll ? (
          <ViewAllCard size={CARD_SIZE} onPress={onViewAll} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD_SIZE,
  },
  info: {
    paddingTop: 8,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
});
