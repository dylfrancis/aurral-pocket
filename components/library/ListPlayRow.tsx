import { StyleSheet, View } from "react-native";
import { PLAY_ROW_HEIGHT, PlayRow } from "@/components/ui/PlayRow";

/** Nothing fills the third slot, so a spacer keeps Play centered. */
export function ListPlayRow({
  title,
  disabled,
  onPlay,
  onShuffle,
}: {
  title: string;
  disabled?: boolean;
  onPlay: () => void;
  onShuffle: () => void;
}) {
  return (
    <PlayRow
      title={title}
      disabled={disabled}
      onPlay={onPlay}
      onShuffle={onShuffle}
    >
      <View style={styles.spacer} />
    </PlayRow>
  );
}

const styles = StyleSheet.create({
  spacer: {
    width: PLAY_ROW_HEIGHT,
    height: PLAY_ROW_HEIGHT,
  },
});
