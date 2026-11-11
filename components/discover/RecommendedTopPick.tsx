import { Pressable, StyleSheet, View } from "react-native";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { topPickReason } from "@/lib/discover/recommended";
import type { DiscoveryArtist } from "@/lib/types/search";

const COVER_SIZE = 112;
const TAG_LIMIT = 3;

type Props = {
  artist: DiscoveryArtist;
  seeds: ReadonlySet<string>;
  onPress: () => void;
};

export function RecommendedTopPick({ artist, seeds, onPress }: Props) {
  const colors = Colors[useColorScheme()];
  const reason = topPickReason(artist, seeds);
  const tagLine = artist.matchedTags.slice(0, TAG_LIMIT).join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
    >
      <CoverArtImage
        type="artist"
        mbid={artist.id}
        size={COVER_SIZE}
        borderRadius={12}
      />
      <View style={styles.info}>
        <Text
          variant="caption"
          style={[styles.label, { color: colors.subtle }]}
        >
          Top pick
        </Text>
        <Text
          variant="subtitle"
          style={[styles.name, { color: colors.text }]}
          numberOfLines={2}
        >
          {artist.name}
        </Text>
        {reason ? (
          <Text
            variant="caption"
            style={{ color: colors.text }}
            numberOfLines={2}
          >
            {reason}
          </Text>
        ) : null}
        {tagLine ? (
          <Text
            variant="caption"
            style={{ color: colors.subtle }}
            numberOfLines={1}
          >
            {tagLine}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 12,
  },
  name: {
    ...Fonts.bold,
    fontSize: 20,
    lineHeight: 25,
  },
});
