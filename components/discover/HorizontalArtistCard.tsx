import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CoverArtImage } from "@/components/library/CoverArtImage";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

export type HorizontalArtistCardProps = {
  mbid: string;
  name: string;
  subtitle?: string;
  isInLibrary?: boolean;
  onPress: () => void;
  fill?: boolean;
};

const CARD_WIDTH = 130;

function HorizontalArtistCardComponent({
  mbid,
  name,
  subtitle,
  isInLibrary,
  onPress,
  fill,
}: HorizontalArtistCardProps) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      style={({ pressed }) => [
        fill ? styles.cardFill : styles.card,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.coverWrap}>
        <CoverArtImage
          type="artist"
          mbid={mbid}
          size={fill ? "fill" : CARD_WIDTH}
          borderRadius={10}
        />
        {isInLibrary && (
          <View style={[styles.badge, { backgroundColor: colors.card }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text
          variant="body"
          style={[
            styles.name,
            { color: colors.text, fontFamily: Fonts.semiBold },
          ]}
          numberOfLines={2}
        >
          {name}
        </Text>
        {!!subtitle && (
          <Text
            variant="caption"
            style={[styles.subtitle, { color: colors.subtle }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const HorizontalArtistCard = React.memo(HorizontalArtistCardComponent);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
  },
  cardFill: {
    flex: 1,
  },
  coverWrap: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 999,
    padding: 2,
  },
  info: {
    paddingTop: 8,
    gap: 2,
    height: 60,
  },
  name: {
    fontSize: 13,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
});
