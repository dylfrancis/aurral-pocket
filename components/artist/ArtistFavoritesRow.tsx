import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

const PHOTO_SIZE = 56;
const BADGE_SIZE = 22;

function counted(count: number, noun: string) {
  return count === 0 ? null : `${count} ${noun}${count === 1 ? "" : "s"}`;
}

type ArtistFavoritesRowProps = {
  artistName: string;
  mbid: string;
  coverUrl?: string;
  albumCount: number;
  songCount: number;
  onPress: () => void;
};

/** The artist's photo with a heart, "Favorites", and "2 albums · 4 songs". */
export function ArtistFavoritesRow({
  artistName,
  mbid,
  coverUrl,
  albumCount,
  songCount,
  onPress,
}: ArtistFavoritesRowProps) {
  const colors = useColors();
  const summary = [
    counted(albumCount, "album"),
    counted(songCount, "song"),
    artistName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Favorites, ${summary}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View>
        <CoverArtImage
          type="artist"
          mbid={mbid}
          coverUrl={coverUrl}
          size={PHOTO_SIZE}
        />
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.brand, borderColor: colors.background },
          ]}
        >
          <Ionicons name="heart" size={11} color={colors.buttonPrimaryText} />
        </View>
      </View>
      <View style={styles.meta}>
        <Text variant="body" style={[styles.title, { color: colors.text }]}>
          Favorites
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: Radius.round,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
});
