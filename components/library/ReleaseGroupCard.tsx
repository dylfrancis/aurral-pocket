import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { Fonts } from "@/constants/theme";
import type { ReleaseGroup } from "@/lib/types/library";
import { releaseYear } from "@/lib/date-time";
import { formatCompactCount } from "@/lib/discover/trending-format";
import { useColors } from "@/hooks/use-colors";

const CARD_WIDTH = 150;

type ReleaseGroupCardProps = {
  releaseGroup: ReleaseGroup;
  onPress?: () => void;
  /** Opens the album's actions. */
  onLongPress?: () => void;
  fill?: boolean;
};

export const ReleaseGroupCard = React.memo(function ReleaseGroupCard({
  releaseGroup,
  onPress,
  onLongPress,
  fill,
}: ReleaseGroupCardProps) {
  const colors = useColors();

  const year = releaseYear(releaseGroup["first-release-date"]);

  const type = releaseGroup["primary-type"] ?? "Album";
  const secondary = releaseGroup["secondary-types"];
  const typeLabel =
    secondary && secondary.length > 0
      ? `${type} · ${secondary.join(", ")}`
      : type;
  const listenerLabel = releaseGroup.listenerCount
    ? formatCompactCount(releaseGroup.listenerCount)
    : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        fill ? styles.containerFill : styles.container,
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <CoverArtImage
        type="album"
        mbid={releaseGroup.id}
        size={fill ? "fill" : CARD_WIDTH}
        borderRadius={10}
      />
      <View style={styles.meta}>
        <Text variant="body" numberOfLines={2} style={styles.title}>
          {releaseGroup.title}
        </Text>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.subtle }}
        >
          {year && `${year} · `}
          {typeLabel}
        </Text>
        {listenerLabel ? (
          // Its own line, so a long type never cuts the count off.
          <View style={styles.listeners}>
            <Ionicons name="headset-outline" size={11} color={colors.subtle} />
            <Text
              variant="caption"
              numberOfLines={1}
              accessibilityLabel={`${listenerLabel} listeners`}
              style={{ color: colors.subtle }}
            >
              {listenerLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: 12,
  },
  containerFill: {
    flex: 1,
  },
  meta: {
    paddingTop: 6,
    gap: 2,
  },
  title: {
    ...Fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  listeners: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
});
