import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

type Props = {
  done: number;
  total: number;
  height?: number;
};

export function ProgressBar({ done, total, height = 6 }: Props) {
  const colors = Colors[useColorScheme()];
  const cappedDone = Math.max(0, Math.min(done, total));
  const ratio = total > 0 ? cappedDone / total : 0;
  const isComplete = total > 0 && cappedDone >= total;
  const fillColor = isComplete ? colors.complete : colors.brand;

  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: colors.separator,
        },
      ]}
    >
      <View
        style={{
          width: `${ratio * 100}%`,
          height: "100%",
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
  },
});
