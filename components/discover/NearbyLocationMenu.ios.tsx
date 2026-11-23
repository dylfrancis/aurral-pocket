import { Host } from "@expo/ui";
import { HStack, Image, Menu, Text, Toggle } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { HAS_LIQUID_GLASS } from "@/constants/navigation";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  ENTER_LOCATION_LABEL,
  savedLocationSubtitle,
  YOUR_LOCATION_LABEL,
  type NearbyLocationMenuProps,
} from "./nearby-location-menu-types";

/** A capsule naming the city that opens the location choices in a SwiftUI menu. */
export function NearbyLocationMenu({
  cityLabel,
  mode,
  appliedZip,
  appliedCountry,
  onSelectYourLocation,
  onEnterLocation,
  triggerColor,
}: NearbyLocationMenuProps) {
  const scheme = useColorScheme();
  const saved = savedLocationSubtitle(appliedZip, appliedCountry);

  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <Menu
        label={
          <HStack spacing={4}>
            <Text>{cityLabel}</Text>
            <Image systemName="chevron.down" size={11} color={triggerColor} />
          </HStack>
        }
        modifiers={[
          buttonStyle(HAS_LIQUID_GLASS ? "glass" : "bordered"),
          buttonBorderShape("capsule"),
          controlSize("small"),
          foregroundStyle(triggerColor),
          accessibilityLabel(`Location, ${cityLabel}`),
        ]}
      >
        {/* Toggles give the menu its checkmark; JS holds `isOn`. */}
        <Toggle
          label={YOUR_LOCATION_LABEL}
          systemImage="location"
          isOn={mode === "ip"}
          onIsOnChange={() => onSelectYourLocation()}
        />
        <Toggle isOn={mode === "zip"} onIsOnChange={() => onEnterLocation()}>
          <Text>{ENTER_LOCATION_LABEL}</Text>
          {saved ? <Text>{saved}</Text> : null}
        </Toggle>
      </Menu>
    </Host>
  );
}
