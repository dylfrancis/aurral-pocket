import { useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import ArrowCircleDown from "@expo/material-symbols/arrow_circle_down.xml";
import DownloadForOffline from "@expo/material-symbols/download_for_offline.xml";
import Downloading from "@expo/material-symbols/downloading.xml";
import { IS_IOS } from "@/constants/platform";
import {
  removeSaved,
  retrySaved,
  useSavedStatus,
  type SavedKind,
} from "@/lib/offline/saved-library";

export const SAVE_OFFLINE_ICONS = {
  save: IS_IOS ? "arrow.down.circle" : ArrowCircleDown,
  saving: IS_IOS ? "arrow.down.circle.dotted" : Downloading,
  saved: IS_IOS ? "arrow.down.circle.fill" : DownloadForOffline,
} as const;

/**
 * The toolbar's Save Offline button for an album or playlist page. One tap
 * saves. Once something is saved, or saving, a tap asks before removing it,
 * and an album Favorites keeps says so instead. `save` is null while there's
 * nothing to save yet. A playlist's page builds a menu from `remove` and
 * `retry` instead of using `onPress`.
 */
export function useSaveOffline({
  kind,
  id,
  title,
  save,
}: {
  kind: SavedKind;
  id: string;
  title: string;
  save: (() => void) | null;
}) {
  const status = useSavedStatus(kind, id);
  const state = status?.state ?? null;
  const byFavorites = !!status?.item.favorite;

  /** Asks first. Saved tracks go with the save, as do ones still to come. */
  const remove = useCallback(() => {
    const removeNow = () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      void removeSaved(kind, id);
    };
    if (state === "saving" || state === "waiting") {
      Alert.alert(
        "Stop Saving?",
        `Tracks of “${title}” already saved are removed too.`,
        [
          { text: "Keep Saving", style: "cancel" },
          { text: "Stop", style: "destructive", onPress: removeNow },
        ],
      );
      return;
    }
    Alert.alert(
      "Remove from Phone?",
      `“${title}” will need a connection to play.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: removeNow },
      ],
    );
  }, [state, kind, id, title]);

  const retry = useCallback(() => retrySaved(kind, id), [kind, id]);

  const onPress = useCallback(() => {
    if (state === null) {
      if (!save) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      save();
      return;
    }
    // Removing it here would only last until Favorites saved it again.
    if (byFavorites) {
      const message =
        "Favorites keeps this album on your phone while it’s a favorite.";
      if (state === "incomplete") {
        Alert.alert(
          "Saved with Favorites",
          `${message} Some of its tracks couldn’t be saved.`,
          [{ text: "Try Again", onPress: retry }, { text: "OK" }],
        );
        return;
      }
      Alert.alert("Saved with Favorites", message, [{ text: "OK" }]);
      return;
    }
    if (state === "incomplete") {
      Alert.alert(
        "Some Tracks Weren’t Saved",
        "The server couldn’t send them. You can try again, or remove what was saved.",
        [
          { text: "Try Again", onPress: retry },
          {
            text: "Remove from Phone",
            style: "destructive",
            onPress: () => {
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              void removeSaved(kind, id);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }
    remove();
  }, [state, save, byFavorites, retry, remove, kind, id]);

  const icon =
    state === "saved"
      ? SAVE_OFFLINE_ICONS.saved
      : state === null
        ? SAVE_OFFLINE_ICONS.save
        : SAVE_OFFLINE_ICONS.saving;
  const label =
    state === "saved"
      ? "Saved offline"
      : state === null
        ? "Save offline"
        : "Saving offline";

  return {
    status,
    icon,
    label,
    disabled: state === null && !save,
    onPress,
    remove,
    retry,
  };
}
