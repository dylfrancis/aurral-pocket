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

const ICONS = {
  save: IS_IOS ? "arrow.down.circle" : ArrowCircleDown,
  saving: IS_IOS ? "arrow.down.circle.dotted" : Downloading,
  saved: IS_IOS ? "arrow.down.circle.fill" : DownloadForOffline,
} as const;

/**
 * The toolbar's Save Offline button for an album or playlist page. One tap
 * saves. Once something is saved, or saving, a tap asks before removing it.
 * `save` is null while there's nothing to save yet.
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

  const onPress = useCallback(() => {
    const remove = () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      void removeSaved(kind, id);
    };

    if (state === null) {
      if (!save) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      save();
      return;
    }
    if (state === "saved") {
      Alert.alert(
        "Remove from Phone?",
        `“${title}” will need a connection to play.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: remove },
        ],
      );
      return;
    }
    if (state === "incomplete") {
      Alert.alert(
        "Some Tracks Weren’t Saved",
        "The server couldn’t send them. You can try again, or remove what was saved.",
        [
          { text: "Try Again", onPress: () => retrySaved(kind, id) },
          { text: "Remove from Phone", style: "destructive", onPress: remove },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }
    Alert.alert(
      "Stop Saving?",
      `Tracks of “${title}” already saved are removed too.`,
      [
        { text: "Keep Saving", style: "cancel" },
        { text: "Stop", style: "destructive", onPress: remove },
      ],
    );
  }, [state, save, kind, id, title]);

  const icon =
    state === "saved"
      ? ICONS.saved
      : state === null
        ? ICONS.save
        : ICONS.saving;
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
  };
}
