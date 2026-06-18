import { IconButton } from "@/components/ui/IconButton";

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  tintColor?: string;
  fallbackBackground?: string;
};

export function CloseButton({
  onPress,
  accessibilityLabel = "Close",
  tintColor,
  fallbackBackground,
}: Props) {
  return (
    <IconButton
      icon="close"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      tintColor={tintColor}
      fallbackBackground={fallbackBackground}
    />
  );
}
