import { useMemo } from "react";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors, Fonts } from "@/constants/theme";

type Option<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SegmentedRow<T extends string | number>({
  value,
  options,
  onChange,
}: Props<T>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const labels = useMemo(
    () => options.map((option) => option.label),
    [options],
  );
  const selectedIndex = options.findIndex((option) => option.value === value);

  return (
    <SegmentedControl
      values={labels}
      selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
      appearance={colorScheme}
      backgroundColor={colors.inputBackground}
      tintColor={colors.brand}
      fontStyle={{
        color: colors.subtle,
        fontFamily: Fonts.medium,
      }}
      activeFontStyle={{
        color: colors.buttonPrimaryText,
        fontFamily: Fonts.semiBold,
      }}
      onChange={(event) => {
        const index = event.nativeEvent.selectedSegmentIndex;
        const next = options[index];
        if (next) onChange(next.value);
      }}
    />
  );
}
