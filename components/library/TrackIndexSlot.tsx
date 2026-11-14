import { StyleSheet, View } from "react-native";
import { PlayingBars } from "@/components/library/PlayingBars";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

/**
 * The slot before a track's title: its number, or the equaliser while the
 * player is on it. One slot, not two columns, so titles never shift.
 */
export function TrackIndexSlot({
  number,
  isCurrent,
  isPlaying,
}: {
  number: number;
  isCurrent: boolean;
  isPlaying: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.slot}>
      {isCurrent ? (
        <PlayingBars animating={isPlaying} color={colors.brand} />
      ) : (
        <Text
          variant="caption"
          style={[styles.number, { color: colors.subtle }]}
        >
          {number}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    // Wide enough for a two-digit number; the bars sit in the same box. No
    // fixed height — the bars bring their own, and a number is taller.
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    ...Fonts.medium,
  },
});
