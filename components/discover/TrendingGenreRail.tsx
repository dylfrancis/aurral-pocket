import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { FlowArtwork } from "@/components/flow/FlowArtwork";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import type { TrendingGenre } from "@/lib/types/search";
import { EditorialArtwork } from "./EditorialArtwork";
import { useColors } from "@/hooks/use-colors";

const CARD_SIZE = 150;
const RADIUS = 10;

type Props = {
  genres: TrendingGenre[];
  onOpenGenre: (genre: TrendingGenre) => void;
};

export function TrendingGenreRail({ genres, onOpenGenre }: Props) {
  return (
    <View style={styles.container}>
      <SectionHeader title="Charts by Genre" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {genres.map((genre) => (
          <Pressable
            key={genre.id}
            onPress={() => onOpenGenre(genre)}
            accessibilityRole="button"
            accessibilityLabel={`Open Top ${genre.name}`}
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <CoverMosaic name={`Top ${genre.name}`} covers={genre.covers} />
            <View style={styles.info}>
              <Text variant="body" numberOfLines={1} style={styles.title}>
                Top {genre.name}
              </Text>
              {genre.artists.length > 0 ? (
                <Text variant="caption" numberOfLines={1}>
                  {genre.artists.join(", ")} and more
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** The art under the covers keeps one that fails to load from leaving a hole. */
function CoverMosaic({ name, covers }: { name: string; covers: string[] }) {
  const colors = useColors();

  if (covers.length < 4) {
    return (
      <EditorialArtwork
        name={name}
        uri={covers[0] ?? null}
        size={CARD_SIZE}
        radius={RADIUS}
      />
    );
  }

  return (
    <View style={[styles.mosaic, { borderColor: colors.separator }]}>
      <FlowArtwork
        name={name}
        kind="playlist"
        size={CARD_SIZE}
        radius={RADIUS}
      />
      <View style={styles.tiles}>
        {/* Two songs off one album share a cover, so the URL isn't a key. */}
        {covers.slice(0, 4).map((uri, index) => (
          <Image
            key={index}
            source={{ uri }}
            style={styles.tile}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ))}
      </View>
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
  mosaic: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tiles: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tile: {
    width: "50%",
    height: "50%",
  },
  info: {
    paddingTop: 8,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
});
