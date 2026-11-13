import AlbumIcon from "@expo/material-symbols/album.xml";
import ArrowCircleDownIcon from "@expo/material-symbols/arrow_circle_down.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import DownloadForOfflineIcon from "@expo/material-symbols/download_for_offline.xml";
import FileDownloadOffIcon from "@expo/material-symbols/file_download_off.xml";
import MoreHorizIcon from "@expo/material-symbols/more_horiz.xml";
import PersonIcon from "@expo/material-symbols/person.xml";
import PlaylistAddIcon from "@expo/material-symbols/playlist_add.xml";
import RefreshIcon from "@expo/material-symbols/refresh.xml";
import StopCircleIcon from "@expo/material-symbols/stop_circle.xml";
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
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ICONS: Record<TrackMenuActionId, ImageSourcePropType> = {
  playlist: PlaylistAddIcon,
  album: AlbumIcon,
  artist: PersonIcon,
  download: DownloadIcon,
  retry: RefreshIcon,
  stop: StopCircleIcon,
  remove: DeleteIcon,
  "save-offline": ArrowCircleDownIcon,
  "remove-offline": FileDownloadOffIcon,
  "saved-with": DownloadForOfflineIcon,
};

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its button.
const POPUP_PROPERTIES = { clippingEnabled: false };

export function TrackMenu({
  actions,
  onAction,
  triggerColor,
  compact = false,
  accessibilityLabel = "More actions",
}: TrackMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const errorColor = Colors[useColorScheme()].error;

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
              size={compact ? 22 : 26}
              contentDescription={accessibilityLabel}
            />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              enabled={!action.disabled}
              elementColors={
                action.destructive
                  ? { textColor: errorColor, leadingIconColor: errorColor }
                  : undefined
              }
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
