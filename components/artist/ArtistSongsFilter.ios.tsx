import { Host } from "@expo/ui";
import { Image, Menu, Section, Text, Toggle } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  contentShape,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  ARTIST_SONGS_SHOW_OPTIONS,
  artistSongsFilterLabel,
  type ArtistSongsFilterProps,
} from "./artist-songs-filter-types";

export function ArtistSongsFilter({ value, onChange }: ArtistSongsFilterProps) {
  const scheme = useColorScheme();
  const colors = useColors();
  const active = value !== "everything";

  return (
    <Host matchContents ignoreSafeArea="all" colorScheme={scheme}>
      <Menu
        label={
          <Image
            systemName={
              active
                ? "line.3.horizontal.decrease.circle.fill"
                : "line.3.horizontal.decrease.circle"
            }
            size={20}
            color={active ? colors.brand : colors.text}
            modifiers={[
              frame({ width: 32, height: 32 }),
              contentShape(shapes.rectangle()),
              accessibilityLabel(artistSongsFilterLabel(value)),
            ]}
          />
        }
      >
        <Section title="Show">
          {/* Toggles give the menu its checkmarks. JS holds `isOn`, so picking
              the checked item again leaves it checked. */}
          {ARTIST_SONGS_SHOW_OPTIONS.map((option) => (
            <Toggle
              key={option.value}
              isOn={value === option.value}
              onIsOnChange={(isOn) => {
                if (isOn) onChange(option.value);
              }}
            >
              <Text>{option.label}</Text>
            </Toggle>
          ))}
        </Section>
      </Menu>
    </Host>
  );
}
