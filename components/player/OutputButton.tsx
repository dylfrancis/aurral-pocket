import * as Burnt from "burnt";
import { Pressable, StyleSheet, View } from "react-native";
import { OutputIcon } from "@/components/player/OutputIcon";
import { Text } from "@/components/ui/Text";
import { Fonts } from "@/constants/theme";
import { useAudioOutput } from "@/hooks/player/use-audio-output";
import {
  OutputPickerView,
  outputPicker,
  showOutputPicker,
  type AudioOutput,
} from "@/modules/audio-output";

type OutputButtonProps = {
  color: string;
  /** For any output but the phone, as shuffle shows it's on. */
  activeColor: string;
};

const LABEL = "Audio output";

/**
 * Names where the audio plays. A tap opens the system's picker: AirPlay on
 * iOS, the output switcher on Android 11 and later.
 */
export function OutputButton({ color, activeColor }: OutputButtonProps) {
  const output = useAudioOutput();
  if (!output) return null;

  const tint = output.kind === "phone" ? color : activeColor;
  const accessibilityValue = { text: output.name };

  if (OutputPickerView) {
    return (
      <View style={styles.button}>
        {/* The picker view on top is what VoiceOver reads and taps. */}
        <OutputLabel output={output} tint={tint} hidden />
        <OutputPickerView
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="button"
          accessibilityLabel={LABEL}
          accessibilityValue={accessibilityValue}
        />
      </View>
    );
  }

  if (outputPicker === "switcher") {
    return (
      <Pressable
        onPress={openSwitcher}
        accessibilityRole="button"
        accessibilityLabel={LABEL}
        accessibilityValue={accessibilityValue}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <OutputLabel output={output} tint={tint} />
      </Pressable>
    );
  }

  // Android 10 and earlier have no switcher, so the output is only shown.
  return (
    <View
      accessible
      accessibilityLabel={LABEL}
      accessibilityValue={accessibilityValue}
      style={styles.button}
    >
      <OutputLabel output={output} tint={tint} />
    </View>
  );
}

function OutputLabel({
  output,
  tint,
  hidden = false,
}: {
  output: AudioOutput;
  tint: string;
  hidden?: boolean;
}) {
  return (
    <View
      style={styles.label}
      pointerEvents="none"
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
    >
      <OutputIcon color={tint} />
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.name, { color: tint }]}
      >
        {output.name}
      </Text>
    </View>
  );
}

function openSwitcher() {
  const failed = () =>
    // Android shows a toast's title alone.
    Burnt.toast({
      title: "Couldn't open the output switcher",
      preset: "error",
    });
  showOutputPicker().then((shown) => {
    if (!shown) failed();
  }, failed);
}

const styles = StyleSheet.create({
  // Shrinks before the toolbar's right side does, cutting the name short.
  button: {
    flexShrink: 1,
    height: 44,
    justifyContent: "center",
  },
  label: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    ...Fonts.medium,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
