import AlbumIcon from "@expo/material-symbols/album.xml";
import MoreHorizIcon from "@expo/material-symbols/more_horiz.xml";
import PersonIcon from "@expo/material-symbols/person.xml";
import PlaylistAddIcon from "@expo/material-symbols/playlist_add.xml";
import { Host } from "@expo/ui";
import {
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import type { ImageSourcePropType } from "react-native";
import type {
  TrackMenuActionId,
  TrackMenuProps,
} from "@/components/player/track-menu-types";

const ICONS: Record<TrackMenuActionId, ImageSourcePropType> = {
  playlist: PlaylistAddIcon,
  album: AlbumIcon,
  artist: PersonIcon,
};

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its button.
const POPUP_PROPERTIES = { clippingEnabled: false };

export function TrackMenu({ actions, onAction, triggerColor }: TrackMenuProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Host matchContents>
      <DropdownMenu
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
        properties={POPUP_PROPERTIES}
      >
        <DropdownMenu.Trigger>
          <IconButton onClick={() => setExpanded(true)}>
            <Icon
              source={MoreHorizIcon}
              tint={triggerColor}
              size={26}
              contentDescription="More actions"
            />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => {
                setExpanded(false);
                onAction(action.id);
              }}
            >
              <DropdownMenuItem.Text>
                <Text>{action.title}</Text>
              </DropdownMenuItem.Text>
              <DropdownMenuItem.LeadingIcon>
                <Icon source={ICONS[action.id]} size={24} />
              </DropdownMenuItem.LeadingIcon>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
