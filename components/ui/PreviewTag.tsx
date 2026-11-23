import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Fonts, Radius } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

/** Beside a song's title: it plays a thirty-second clip, not a Library file. */
export function PreviewTag() {
  const colors = useColors();

  return (
    <View style={[styles.tag, { borderColor: colors.subtle }]}>
      <Text variant="caption" style={[styles.label, { color: colors.subtle }]}>
        Preview
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.round,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  label: {
    ...Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
