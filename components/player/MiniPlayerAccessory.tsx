import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, View } from "react-native";
import { MiniPlayer } from "@/components/player/MiniPlayer";

/**
 * The mini player as iOS 26+ hosts it: inside the tab bar's bottom
 * accessory, where the system supplies the liquid glass capsule. The system
 * renders one copy per placement; the inline copy sits beside a minimized
 * tab bar and gets the compact layout.
 */
export function MiniPlayerAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();

  return (
    <View style={styles.fill}>
      <MiniPlayer compact={placement === "inline"} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: "center",
  },
});
