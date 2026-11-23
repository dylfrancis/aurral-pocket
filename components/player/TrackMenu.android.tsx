import AlbumIcon from "@expo/material-symbols/album.xml";
import ArrowCircleDownIcon from "@expo/material-symbols/arrow_circle_down.xml";
import DeleteIcon from "@expo/material-symbols/delete.xml";
import DownloadIcon from "@expo/material-symbols/download.xml";
import DownloadForOfflineIcon from "@expo/material-symbols/download_for_offline.xml";
import ExtensionIcon from "@expo/material-symbols/extension.xml";
import FileDownloadOffIcon from "@expo/material-symbols/file_download_off.xml";
import LibraryAddIcon from "@expo/material-symbols/library_add.xml";
import MoreHorizIcon from "@expo/material-symbols/more_horiz.xml";
import PersonIcon from "@expo/material-symbols/person.xml";
import PlaylistAddIcon from "@expo/material-symbols/playlist_add.xml";
import RefreshIcon from "@expo/material-symbols/refresh.xml";
import StopCircleIcon from "@expo/material-symbols/stop_circle.xml";
import { Host } from "@expo/ui";
import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  IconButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import type { ImageSourcePropType } from "react-native";
import type {
  TrackMenuAction,
  TrackMenuActionId,
  TrackMenuProps,
} from "@/components/player/track-menu-types";
import { useColors } from "@/hooks/use-colors";

const ICONS: Record<TrackMenuActionId, ImageSourcePropType> = {
  library: LibraryAddIcon,
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
  delete: DeleteIcon,
};

// A clipped popup loses the status bar offset, so near the bottom of an
// edge-to-edge screen it detaches from its button.
const POPUP_PROPERTIES = { clippingEnabled: false };

export function TrackMenu({
  actions,
  onAction,
  pluginActions = [],
  trailingActions = [],
  triggerColor,
  compact = false,
  accessibilityLabel = "More actions",
}: TrackMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const errorColor = useColors().error;

  const actionItem = (action: TrackMenuAction) => (
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
  );

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
          {actions.map(actionItem)}
          {pluginActions.length > 0 && <HorizontalDivider />}
          {pluginActions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              enabled={!action.running}
              onClick={() => {
                setExpanded(false);
                action.run();
              }}
            >
              <DropdownMenuItem.Text>
                <Text>{action.label}</Text>
              </DropdownMenuItem.Text>
              <DropdownMenuItem.LeadingIcon>
                <Icon source={ExtensionIcon} size={24} />
              </DropdownMenuItem.LeadingIcon>
            </DropdownMenuItem>
          ))}
          {pluginActions.length > 0 && trailingActions.length > 0 && (
            <HorizontalDivider />
          )}
          {trailingActions.map(actionItem)}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
