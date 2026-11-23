import Check from "@expo/material-symbols/check.xml";
import FilterList from "@expo/material-symbols/filter_list.xml";
import { Host } from "@expo/ui";
import {
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  ARTIST_SONGS_SHOW_OPTIONS,
  artistSongsFilterLabel,
  type ArtistSongsFilterProps,
} from "./artist-songs-filter-types";

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its button.
const POPUP_PROPERTIES = { clippingEnabled: false };

export function ArtistSongsFilter({ value, onChange }: ArtistSongsFilterProps) {
  const scheme = useColorScheme();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <Host matchContents colorScheme={scheme}>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
        properties={POPUP_PROPERTIES}
      >
        <DropdownMenu.Trigger>
          <IconButton onClick={() => setExpanded(true)}>
            {/* Material Symbols ship outlined only, so the brand color marks
                a filter that's on. */}
            <Icon
              source={FilterList}
              size={24}
              tint={value === "everything" ? colors.text : colors.brand}
              contentDescription={artistSongsFilterLabel(value)}
            />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {ARTIST_SONGS_SHOW_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                setExpanded(false);
                if (option.value !== value) onChange(option.value);
              }}
            >
              <DropdownMenuItem.Text>
                {/* Android's text doesn't follow the app's light or dark choice. */}
                <Text color={colors.text}>{option.label}</Text>
              </DropdownMenuItem.Text>
              {option.value === value ? (
                <DropdownMenuItem.TrailingIcon>
                  <Icon source={Check} size={24} tint={colors.brand} />
                </DropdownMenuItem.TrailingIcon>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
