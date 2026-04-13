import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  type TextLayoutEvent,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type ArtistBioSectionProps = {
  bio: string | null | undefined;
  artistName: string;
  mbid: string;
};

export function ArtistBioSection({
  bio,
  artistName,
  mbid,
}: ArtistBioSectionProps) {
  const colors = Colors[useColorScheme()];
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const onTextLayout = useCallback((e: TextLayoutEvent) => {
    setTruncated(e.nativeEvent.lines.length >= 4);
  }, []);

  return (
    <>
      {bio && (
        <View style={styles.bioSection}>
          <Text
            variant="caption"
            style={[styles.label, { color: colors.subtle }]}
          >
            About
          </Text>
          <Text
            variant="caption"
            style={styles.bio}
            numberOfLines={expanded ? undefined : 4}
            onTextLayout={onTextLayout}
          >
            {bio}
          </Text>
          {(truncated || expanded) && (
            <Pressable onPress={() => setExpanded((prev) => !prev)}>
              <Text variant="caption" style={{ color: colors.brand }}>
                {expanded ? "Show less" : "Show more"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.links}>
        <Pressable
          style={({ pressed }) => [
            styles.linkButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() =>
            Linking.openURL(
              `https://www.last.fm/music/${encodeURIComponent(artistName)}`,
            )
          }
        >
          <Ionicons name="open-outline" size={18} color={colors.brand} />
          <Text variant="caption" style={{ color: colors.text }}>
            Last.fm
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.linkButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() =>
            Linking.openURL(`https://musicbrainz.org/artist/${mbid}`)
          }
        >
          <Ionicons name="open-outline" size={18} color={colors.brand} />
          <Text variant="caption" style={{ color: colors.text }}>
            MusicBrainz
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bioSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 6,
  },
  label: {
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 14,
    paddingVertical: 8,
  },
  bio: {
    lineHeight: 18,
  },
  links: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});
