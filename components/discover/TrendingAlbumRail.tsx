import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import type { TrendingAlbum } from "@/lib/types/search";
import { useColors } from "@/hooks/use-colors";

const CARD_SIZE = 140;

type Props = {
  albums: TrendingAlbum[];
  lookingUpKey: string | null;
  onOpenAlbum: (album: TrendingAlbum) => void;
};

export function TrendingAlbumRail({
  albums,
  lookingUpKey,
  onOpenAlbum,
}: Props) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <SectionHeader title="Top Albums" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {albums.map((album) => (
          <Pressable
            key={album.key}
            onPress={() => onOpenAlbum(album)}
            accessibilityRole="button"
            accessibilityLabel={`No. ${album.position}, ${album.name} by ${album.artistName}`}
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View>
              <CoverArtImage
                type="album"
                mbid=""
                coverUrl={album.artworkUrl}
                size={CARD_SIZE}
                borderRadius={10}
              />
              <View
                style={[
                  styles.rank,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.separator,
                  },
                ]}
              >
                <Text variant="caption" style={styles.rankText}>
                  {album.position}
                </Text>
              </View>
              {lookingUpKey === album.key ? (
                <View style={styles.lookup}>
                  <ActivityIndicator color="#ffffff" />
                </View>
              ) : null}
            </View>
            <View style={styles.info}>
              <Text variant="body" numberOfLines={1} style={styles.title}>
                {album.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {album.artistName}
              </Text>
            </View>
          </Pressable>
        ))}
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
  rank: {
    position: "absolute",
    left: 6,
    bottom: 6,
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  rankText: {
    ...Fonts.semiBold,
    fontVariant: ["tabular-nums"],
  },
  lookup: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    paddingTop: 8,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
});
