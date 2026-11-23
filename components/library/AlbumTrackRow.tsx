import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Text } from "@/components/ui/Text";
import {
  TRACK_MENU_BUTTON_WIDTH,
  TrackMenuButton,
} from "@/components/library/TrackMenuButton";
import { useColors } from "@/hooks/use-colors";

type AlbumTrackRowProps = {
  /** Before the title: the track number, or a play button. */
  leading: React.ReactNode;
  title: string;
  /** Tints the title while the player or a clip is on this track. */
  active?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  /** Under the title, such as a clip's progress. */
  below?: React.ReactNode;
  /** After the title, before the ⋯ button. */
  trailing?: React.ReactNode;
  /** Opens the track's actions. Omitted, the row shows no ⋯ button. */
  onMenuPress?: () => void;
  /**
   * Keeps the ⋯ button's room on a row without one, so its trailing icons
   * stay in a column with the rows that have it.
   */
  holdMenuSpace?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Fades a track that can't play right now. */
  dimmed?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
};

/**
 * A row in an album's track list, shared by the Library album page and the
 * release page so their rows keep one height and inset.
 */
export function AlbumTrackRow({
  leading,
  title,
  active = false,
  titleStyle,
  below,
  trailing,
  onMenuPress,
  holdMenuSpace = false,
  onPress,
  onLongPress,
  dimmed = false,
  accessibilityRole,
  accessibilityLabel,
}: AlbumTrackRowProps) {
  const colors = useColors();
  const interactive = !!onPress || !!onLongPress;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!interactive}
      // A row with nothing to press and nothing to announce leaves screen
      // readers to reach the buttons inside it on their own.
      accessible={interactive || accessibilityLabel !== undefined}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.separator },
        dimmed ? styles.dimmed : null,
        pressed && interactive ? { opacity: 0.6 } : null,
      ]}
    >
      {leading}
      <View style={styles.body}>
        <Text
          variant="body"
          numberOfLines={1}
          style={[titleStyle, active && { color: colors.brand }]}
        >
          {title}
        </Text>
        {below}
      </View>
      {trailing}
      {onMenuPress ? (
        <TrackMenuButton trackName={title} onPress={onMenuPress} />
      ) : holdMenuSpace ? (
        <View style={styles.menuSpace} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  dimmed: {
    opacity: 0.4,
  },
  menuSpace: {
    width: TRACK_MENU_BUTTON_WIDTH,
  },
});
