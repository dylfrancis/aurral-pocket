import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { EditorialArtwork } from "./EditorialArtwork";

type Props = {
  name: string;
  caption: string;
  artworkUrl: string | null;
  size: number;
  onPress: () => void;
  /** Opens the playlist's actions. */
  onLongPress?: () => void;
};

/** A playlist's or a Browse category's cover with its name underneath. */
export function EditorialCard({
  name,
  caption,
  artworkUrl,
  size,
  onPress,
  onLongPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.7 : 1 })}
    >
      <EditorialArtwork
        name={name}
        coverUrl={artworkUrl}
        size={size}
        radius={10}
      />
      <View style={styles.info}>
        <Text variant="body" numberOfLines={1} style={styles.title}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  info: {
    paddingTop: 8,
    gap: 2,
  },
  title: {
    ...Fonts.semiBold,
  },
});
