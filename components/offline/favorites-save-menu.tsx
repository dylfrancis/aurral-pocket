import { Stack } from "expo-router";
import AlbumIcon from "@expo/material-symbols/album.xml";
import ArrowCircleDown from "@expo/material-symbols/arrow_circle_down.xml";
import FileDownloadOff from "@expo/material-symbols/file_download_off.xml";
import Refresh from "@expo/material-symbols/refresh.xml";
import { checkableMenuItem } from "@/components/ui/MenuOptions";
import { IS_IOS } from "@/constants/platform";
import { SAVE_OFFLINE_ICONS } from "@/hooks/offline/use-save-offline";
import type { FavoritesSaveMode, SaveState } from "@/lib/offline/saved-library";

/**
 * The Favorites toolbar's ↓. Off, it offers to save songs, or songs and
 * albums. On, it checks the one in use, switches to the other, and stops. A
 * plain function, not a component, so the toolbar sees a Menu.
 */
export function favoritesSaveMenu({
  mode,
  state,
  onChoose,
  onRetry,
}: {
  /** Null while Favorites saves nothing. */
  mode: FavoritesSaveMode | null;
  state: SaveState | null;
  onChoose: (mode: FavoritesSaveMode | null) => void;
  onRetry: () => void;
}) {
  const icon =
    state === null
      ? SAVE_OFFLINE_ICONS.save
      : state === "saved"
        ? SAVE_OFFLINE_ICONS.saved
        : SAVE_OFFLINE_ICONS.saving;
  const label =
    state === null
      ? "Save favorites offline"
      : state === "saved"
        ? "Favorites saved offline"
        : "Saving favorites offline";
  const songsIcon = IS_IOS ? "arrow.down.circle" : ArrowCircleDown;
  const albumsIcon = IS_IOS ? "square.stack" : AlbumIcon;

  if (!mode) {
    return (
      <Stack.Toolbar.Menu icon={icon} accessibilityLabel={label}>
        <Stack.Toolbar.MenuAction
          icon={songsIcon}
          onPress={() => onChoose("songs")}
        >
          Save Songs
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={albumsIcon}
          onPress={() => onChoose("songs-and-albums")}
        >
          Save Songs and Albums
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    );
  }

  return (
    <Stack.Toolbar.Menu icon={icon} accessibilityLabel={label}>
      <Stack.Toolbar.Menu inline title="Keep on This Phone">
        <Stack.Toolbar.MenuAction
          {...checkableMenuItem(mode === "songs", songsIcon)}
          onPress={() => onChoose("songs")}
        >
          Songs
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          {...checkableMenuItem(mode === "songs-and-albums", albumsIcon)}
          onPress={() => onChoose("songs-and-albums")}
        >
          Songs and Albums
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
      {state === "incomplete" ? (
        <Stack.Toolbar.MenuAction
          icon={IS_IOS ? "arrow.clockwise" : Refresh}
          onPress={onRetry}
        >
          Try Again
        </Stack.Toolbar.MenuAction>
      ) : null}
      <Stack.Toolbar.MenuAction
        icon={IS_IOS ? "xmark.circle" : FileDownloadOff}
        destructive
        onPress={() => onChoose(null)}
      >
        {state === "saving" || state === "waiting"
          ? "Stop Saving"
          : "Remove from Phone"}
      </Stack.Toolbar.MenuAction>
    </Stack.Toolbar.Menu>
  );
}
