import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { CoverArtImage } from "./CoverArtImage";
import { Fonts } from "@/constants/theme";
import type { ReleaseGroup } from "@/lib/types/library";
import { releaseYear } from "@/lib/date-time";
import { useColors } from "@/hooks/use-colors";

const CARD_WIDTH = 150;

type ReleaseGroupCardProps = {
  releaseGroup: ReleaseGroup;
  onPress?: () => void;
  fill?: boolean;
};

export const ReleaseGroupCard = React.memo(function ReleaseGroupCard({
  releaseGroup,
  onPress,
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

  return (
    <Pressable
      onPress={onPress}
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
});
